export default class ImageColor {

    static async load(image, opts={}){
        this.opts = Object.assign({
            size: 2,
            burn: false
        }, opts)
        
        if(typeof image === "string") {
            const src = image
            image = new Image()
            image.src = src
        }

        await this.ready(image)
        const c = document.createElement('canvas')
        c.width = this.opts.size
        c.height = this.opts.size
        const ctx = c.getContext('2d')
        ctx.filter = `blur(${this.opts.size/2}px)`
        ctx.drawImage(image, 0, 0, this.opts.size, this.opts.size)
        if(this.opts.burn) ctx.globalCompositeOperation = "color-burn"
        ctx.drawImage(image, 0, 0, this.opts.size, this.opts.size)

        const pickX = Math.floor(this.opts.size / 2)
        const pickY = Math.floor(this.opts.size / 2)
        const color = ctx.getImageData(pickX, pickY, 1, 1).data
        return `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`
    }

    static async ready(image){
        return new Promise(res => {
                if(image.naturalWidth) return res()
                image.onload = () => res()
        })
    }

}