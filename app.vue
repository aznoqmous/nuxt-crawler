import { UProgress } from './.nuxt/components';
<template>
  <div>
    <title>crawler</title>
    <UContainer>
      <UCard class="mt-5">
        <UForm class="flex flex-col items-center" @submit="submit" :state="formState">
          <UButtonGroup size="xl">
            <UInput placeholder="Enter a URL" v-model="formState.url" :disabled="!!origin"/>
            <UButton type="submit" label="Crawl" :loading="!!origin"/>
          </UButtonGroup>
          <small class="mt-5 text-slate-400" v-if="!!origin">Crawling {{ current }} ...</small>
          <small class="text-slate-500" v-if="currentTries > 1">Retrying (attempt {{ currentTries }}) ...</small>
        </UForm>
        <UProgress class="mt-5" v-if="origin" :value="(rows.length - scheduled.length) / rows.length * 100"></UProgress>
       
        <UTable class="mt-2" 
          v-if="rows.length"
          v-model="selected"
          :rows="rows" 
          :ui="{td: {padding: 'p-0'}, th: {padding: 'px-0 py-1'}}"
          :loading="!!origin"
          :columns="columns"
          @select="select"
        >
          <template #status-data="{row}">
            <UBadge v-if="row.status" size="xs" variant="subtle">
              {{ row.status }}
            </UBadge>
          </template>
          <template #spent-data="{row}">
            <small v-if="row.spent">{{ row.spent }} ms</small>
          </template>
        </UTable>
      </UCard>
    </UContainer>
  </div>
</template>
<script setup>
const opts = {
  schedule: false,
  maxRetries: 5
}
const columns = [{
  key: "id",
  label: "order",
  sortable: true
},{
  key: "status",
  label: "status",
  sortable: true
},
{
  key: "url",
  label: "url",
  sortable: true
},
{
  key: "spent",
  label: "Spent",
  sortable: true
}]
const formState = reactive({
  url: ""
})
let pages = {}
let scheduled = []
const rows = ref([])
const origin = ref("")
const current = ref("")
const currentTries = ref(0)
const selected = ref([])

const submit = async ()=>{

  pages = {}
  scheduled = []
  rows.value = []

  let url = formState.url
  formState.url = ""
  if(!url.match(/^http/)) url = `http://${url}`

  origin.value = (new URL(url)).origin

  url = cleanUrl(url)

  scheduleUrl(url)
  await crawl()
  origin.value = ""
}

const fetchPage = async(url)=>{
  return $fetch("/api/get", {
        method: "POST",
        body: {
          url
        }
      })
}

const getPage = async (url)=>{
  currentTries.value++

  return new Promise(async(resolve)=>{
      fetchPage(url)
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          if(currentTries.value < opts.maxRetries) return getPage()
          resolve({error})
        })
  })
 
}

const cleanUrl = (url)=>{
  return url
    .replace(/\#.*?$/, "")
    .replace(/\/$/, "")
}

const scheduleUrl = (url)=>{
  if(pages[url]) return false;
  const page = reactive({
    id: Object.keys(pages).length + 1,
    status: "",
    url,
    spent: "",
  })
  pages[url] = page
  scheduled.push(page)
  rows.value.push(page)
  return page
}

const crawl = async(page)=>{
  if(!page) page = scheduled[0]
  current.value = page.url
  return new Promise(async resolve => {

    currentTries.value = 0
    const response = await getPage(page.url)
    if(response.error){
      page.status = "Error"
      console.log(currentTries.value)
    }
    else {
      page.status = response.status 
      page.spent = response.spent
    }

    scheduled.splice(scheduled.indexOf(page), 1)
    
    current.value = page.url

    const links = extractLinks(response.text)
    const newPages = links.map(href => scheduleUrl(href)).filter(v => v)
    if(!opts.schedule) await Promise.allSettled(newPages.map(page => crawl(page)))

    if(!scheduled.length) return resolve()

    if(opts.schedule) await crawl(scheduled[0])

    resolve()

  })
}

const extractLinks = (content)=>{
  const html = document.createRange().createContextualFragment(content)
  const hrefs = Array.from(html.querySelectorAll("a[href]"))
  

  return hrefs
    .map(a => a.href = a.href.replace(window.location.origin, ""))
    .map(a => new URL(a, origin.value))
    .filter(a => a.origin == origin.value)
    .map(a => cleanUrl(a.href))
}

const select = (row)=>{
  const index = selected.value.indexOf(row)
  if(index <= 0) selected.value.splice(index, 1)
  else selected.value.push(row)
}
</script>
