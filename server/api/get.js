export default defineEventHandler(async(event)=>{
    const body = await readBody(event)
    
    const start = Date.now()
    const response = await fetch(body.url)
    const {url, status} = response
    const spent = Date.now() - start
    const text = await response.text()

    return {
        url,
        status,
        spent,
        text
    }
})