<template>
  <title>crawler</title>
  <UCard class="min-h-screen">

    <UForm class="flex flex-col min-w-full" @submit="submit" :state="formState">
      <UButtonGroup size="xl">
        <UInput class="min-w-96" placeholder="Enter a URL" v-model="formState.url" :disabled="state == STATE.RUNNING"/>
        <UButton type="submit" label="Crawl" :loading="state == STATE.RUNNING"/>
      </UButtonGroup>
    </UForm>

    <UCard class="mt-5" v-if="origin" style="background: linear-gradient(to bottom, var(--color, transparent), transparent)">
      <div class="flex gap-5">
        <figure v-if="ogImage" style="width: 10rem; aspect-ratio: 1; position: relative;">
          <img class="rounded-lg" ref="ogImageElement" :src="'/' + targetOgImage" style="object-fit: cover; width: 100%; height: 100%;"/>
        </figure>
        <div class="right max-w-2xl" style="text-shadow: 0 0 5rem var(--bg-current)">
          <h2 class="mt-5 text-slate-100 font-bold mix-blend-overlay">{{ origin }}</h2>
          <h1 class="text-slate-100 text-3xl font-bold">{{ title }}</h1>
          <p class="text-slate-300 leading-5">{{ description }}</p>
        </div>
      </div>
      <div class="flex gap-4 mt-2">
        <div v-for="(count, code) in statuses" :key="code">
          
          <UBadge size="xs" variant="soft" :color="statusColors[`${code}`[0]]">
            <strong class="text-slate-200">{{ count }} &nbsp;</strong> {{ code }}
          </UBadge>
        </div> 
      </div>
      
      <div v-if="state == STATE.RUNNING">
        <small class="block text-slate-400 translate-y-5">Crawling {{ current }} ...</small>
        <UProgress 
        class=""
        :value="(rows.length - scheduled.length) / rows.length * 100"
        indicator
        ></UProgress>
      </div>
    </UCard>
      <UTable class="mt-2" 
        v-if="rows.length"
        v-model="selected"
        :rows="rows" 
        :ui="{td: {padding: 'p-0 py-1'}, th: {padding: 'px-0 py-1'}}"
        :loading="state == STATE.RUNNING"
        :columns="columns"
        @select="select"
      >
      <template #status-data="{row}">
        <div v-if="row.status == 'loading'">
          <UIcon name="i-svg-spinners-ring-resize text-primary"></UIcon>
          <span v-if="row.tries > 1">&nbsp; Retrying...  ({{ row.tries }})</span>
        </div>
        <UBadge v-else-if="row.status" size="xs" variant="soft" :color="statusColors[`${row.status}`[0]] || 'red'">
          {{ row.status }}
        </UBadge>
      </template>
      <template #url-data="{row}">
        <ULink :to="row.url" :title="row.url" target="_blank" inactive-class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary max-w-xl block overflow-hidden">{{ row.url }}</ULink>
      </template>
      <template #spent-data="{row}">
        <div v-if="row.spent">
          <UBadge size="xs" variant="soft" v-if="row.spent < 500" color="green">{{ row.spent }} ms</UBadge>
          <UBadge size="xs" variant="soft" v-else-if="row.spent < 1000" color="yellow">{{ row.spent }} ms</UBadge>
          <UBadge size="xs" variant="soft" v-else color="red">{{ row.spent }} ms</UBadge>
        </div> 
      </template>
      <template #sources-data="{row}">
        <div class="flex items-center gap-2" @click="showSources(row)">
          <UMeter class="w-12" v-if="maxSourcesCount" :value="row.sources.length / rows.length * 100"></UMeter>
          <span>{{ row.sources.length }}</span>
        </div>
      </template>
    </UTable>
  </UCard>
  <USlideover v-model="isOpen">
    <div v-if="slideOverPage && slideOverSources" class="p-4">
      <h2 class="text-primary font-bold">{{ slideOverPage.url }}</h2>
      <UTable 
        :rows="slideOverSources"
        :ui="{td: {padding: 'p-0'}, th: {padding: 'px-0 py-1'}}"
        :columns="sliderOverColumns"
      >
        <template #url-data="{row}">
          <ULink :to="row.url" :title="row.url" target="_blank" inactive-class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary max-w-xl block overflow-hidden">{{ row.url }}</ULink>
        </template>
      </UTable>
    </div>
  </USlideover>
</template>
<script setup>
import ImageColor from "~/src/ImageColor"
const opts = {
  maxRetries: 5,
  maxConcurrents: 5
}
const columns = [{
  key: "id",
  label: "Order",
  sortable: true
},
{
  key: "sources",
  label: "Sources",
  sortable: true
},
{
  key: "status",
  label: "Status",
  sortable: true
},
{
  key: "url",
  label: "URL",
  sortable: true
},
{
  key: "title",
  label: "Title",
  sortable: true
},
{
  key: "spent",
  label: "Spent",
  sortable: true
},
]
const sliderOverColumns = [
{
  key: "count",
  label: "Count",
  sortable: true
},
{
  key: "url",
  label: "URL",
  sortable: true
},
]
const statusColors = {
  2: "green", // ok
  3: "blue", // redirects
  4: "yellow", // blocked / not found
  5: "red" // errors
}

const formState = reactive({
  url: ""
})
let pages = {}
let scheduled = []
let running = []
const rows = ref([])
const statuses = ref({})
const origin = ref("")
const current = ref("")
const currentTries = ref(0)
const selected = ref([])
const targetOgImage = ref(null)
const ogImage = ref(null)
const title = ref("")
const description = ref("")
const ogImageElement = ref(null)
const totalSourcesCount = ref(0)
const maxSourcesCount = ref(0)

const isOpen = ref(false)
const slideOverPage = ref(null)
const slideOverSources = ref([])

const STATE = { 
  IDLE: "idle",
  RUNNING: "running",
}
const state = ref(STATE.IDLE)

const submit = async ()=>{
  
  document.body.style.setProperty("--color", "rgb(var(--color-primary-DEFAULT))")
  
  pages = {}
  scheduled = []
  running = []
  rows.value = []
  totalSourcesCount.value = 0
  maxSourcesCount.value = 0

  let url = formState.url
  if(!url.match(/^http/)) url = `http://${url}`
  
  if(!isValidUrl(url)) return;

  formState.url = ""

  origin.value = ""
  current.value = ""
  title.value = null
  description.value = null
  state.value = STATE.RUNNING
  statuses.value = {}

  const redirectTest = await getPage(url)
  parseMetas(redirectTest.text)

  targetOgImage.value = ""
  if(ogImage.value){
  const extension = ogImage.value.split(".").at(-1).replace(/\?.*$/, "")
    targetOgImage.value = "og-image." + extension
    const download = await $fetch("/api/download", {
      method: "POST",
      body: { 
        url: ogImage.value,
        fileName: targetOgImage.value
       }
    })

    ImageColor.load("/" + targetOgImage.value, {burn: true}).then(color => document.body.style.setProperty("--color", color))
  }

  origin.value = new URL(redirectTest.url).origin

  url = cleanUrl(redirectTest.url)

  scheduleUrl(url)

  await crawl()
  state.value = STATE.IDLE

}

const fetchPage = async(url)=>{
  return $fetch("/api/get", {
        method: "POST",
        body: {
          url
        }
      })
}

const sleep = (time)=>{
  return new Promise(res => setTimeout(()=> res(), time))
}

const getPage = async (page)=>{
  const url = page.url ? page.url : page

  if(page.url){
    if(page.tries) await sleep(1000)
    page.tries++
  } 
  return new Promise(async(resolve)=>{
      fetchPage(url)
        .catch(error => {
          if(page.url && page.tries < opts.maxRetries) return getPage(page.url ? page : url)
          resolve({error})
        })
        .then((response)=>{
          resolve(response)
        })
  })
 
}

const cleanUrl = (url)=>{
  return url
    .replace(/\#.*?$/, "")
    .replace(/\/$/, "")
}

const scheduleUrl = (url)=>{
  if(pages[url]) return pages[url];
  const page = reactive({
    id: Object.keys(pages).length + 1,
    status: "",
    url,
    spent: "",
    title: "",
    tries: 0,
    sources: [],
    weightedSources: {}
  })
  pages[url] = page
  scheduled.push(page)
  rows.value.push(page)
  return page
}

const crawl = async(page)=>{
  if(!page) page = scheduled[0]

  scheduled.splice(scheduled.indexOf(page), 1)
  running.push(page)

  current.value = page.url
  return new Promise(async resolve => {
    page.status = "loading"

    currentTries.value = 0
    const response = await getPage(page)
    if(response.error){
      page.status = "Error"
    }
    else {
      page.status = response.status 
      page.spent = response.spent
      addStatus(response.status)
    }

    document.title = `${(rows.value.length - scheduled.length)}/${rows.value.length}`

    // if(page.url != cleanUrl(response.url)) console.log("redirected", page.url, response.url)

    running.splice(running.indexOf(page), 1)
    
    current.value = page.url

    const links = parseContent(page, response.text)
    const newPages = links.map(href => {
      const pageFound = scheduleUrl(href)
      if(pageFound.sources.includes(page)) return;
      pageFound.sources.push(page)
      totalSourcesCount.value++
      if(pageFound.sources.length > maxSourcesCount.value) maxSourcesCount.value = pageFound.sources.length
    })

    if(running.length < opts.maxConcurrents) await crawlPages(scheduled.slice(0, opts.maxConcurrents - running.length))

    resolve()
  })
}

const crawlPages = (pages)=>{
  return Promise.allSettled(pages.map(page => crawl(page)))
}

const getObjectKey = (object, key)=>{
  return object ? object[key] : null
}
const parseMetas = (content)=>{
  const html = document.createRange().createContextualFragment(content)
  ogImage.value = getObjectKey(html.querySelector("meta[property='og:image']"), "content")
  title.value = getObjectKey(html.querySelector("title"), "innerHTML")
  description.value = getObjectKey(html.querySelector("meta[name='description']"), "content")
}

const parseContent = (page, content)=>{
  // 0.2ms
  const hrefs = Array.from(content.matchAll(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gms)).map(href => href[2])
  
  // 2ms
  // const html = document.createRange().createContextualFragment(content)
  // const hrefs = Array.from(html.querySelectorAll("a[href]"))

  const title = content.match(/\<title\>([^\<]*?)\<\/title\>/ms)
  page.title = title ? title[1] : "-"

  return hrefs
    .map(a => new URL(a, origin.value))
    .filter(a => a.origin == origin.value)
    .filter(a => a.href.match(/(html$)|(php$)|(\/[^\.]*$)/))
    .map(a => cleanUrl(a.href))
}

const select = (row)=>{
  const index = selected.value.indexOf(row)
  if(index <= 0) selected.value.splice(index, 1)
  else selected.value.push(row)
}
const addStatus = (code)=>{
  if(!statuses.value[code]) statuses.value[code] = 0
  statuses.value[code]++
}
const isValidUrl = (url)=>{
  try {
    new URL(url)
  }
  catch(e) {
    return false
  }
  return url.match(/\./)
}
const showSources = (page)=>{
  const weightedSources = {}
  slideOverPage.value = page
  page.sources.map(source => {
    if(!weightedSources[source.url]) weightedSources[source.url] = {
      url: source.url, count: 0
    }
    weightedSources[source.url].count++
  })
  slideOverSources.value = Object.values(weightedSources)
  console.log(weightedSources)
  isOpen.value = true
}
</script>