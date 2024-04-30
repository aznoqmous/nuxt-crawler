import fs from "fs"
import path from "path"
import https from "https"
import http from "http"

export default defineEventHandler(async(event)=>{
    const body = await readBody(event)

    const target = body.url
    const fileName = body.fileName
    const url = new URL(target)
    const targetFile = process.cwd() + "/public/" + fileName
    
    return await new Promise(res => {
        console.log(`[RUNNING] Downloading ${target} --> ${targetFile}`)
        fs.mkdir(path.dirname(targetFile), {recursive: true }, (e)=>{
            const file = fs.createWriteStream(targetFile)
            const handler = url.protocol == "https:" ? https : http
            handler.get(url.href, (response)=>{
                response.pipe(file)
                file.on('finish', async ()=>{
                    file.close()
                    console.log(`[COMPLETED] Downloading ${target} --> ${targetFile}`)
                    const stats = await fs.statSync(targetFile)
                    stats.path = targetFile
                    res(stats)
                })
            })
        })
    })
})