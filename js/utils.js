export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class Vector2D {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    static fromObject(obj) {
        return new Vector2D(obj.x, obj.y)
    }

    toObject() {
        return { x: this.x, y: this.y }
    }

    add(vector) {
        return new Vector2D(this.x + vector.x, this.y + vector.y)
    }

    subtract(vector) {
        return new Vector2D(this.x - vector.x, this.y - vector.y)
    }

    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar)
    }

    divide(scalar) {
        return new Vector2D(this.x / scalar, this.y / scalar)
    }

    magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2)
    }

    copy() {
        return new Vector2D(this.x, this.y)
    }
}

export class Images {
    static background = 'assets/images/background.jpg'
    static hole = 'assets/images/hole.png'
    static goal = 'assets/images/goal.png'
}

const imageCache = new Map()

export const loadImage = (src) => {
    if (imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src))
    }

    return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.addEventListener('load', () => {
            imageCache.set(src, img)
            resolve(img)
        })
        img.addEventListener('error', (err) => {
            console.error(`Failed to load image: ${src}`, err)
            reject(new Error(`Failed to load image: ${src}`, { cause: err }))
        })
        img.src = src

        setTimeout(() => {
            if (!img.complete) {
                reject(new Error(`Image loading timed out: ${src}`))
            }
        }, 5000) // 5 seconds timeout
    })
}

export const xhrRequest = async (
    url,
    method = 'GET',
    asArrayBuffer = false
) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open(method, url)
        xhr.responseType = asArrayBuffer ? 'arraybuffer' : 'text'
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(xhr.response)
            } else {
                reject(new Error(`Failed to load ${url}: ${xhr.statusText}`))
            }
        }
        xhr.onerror = (err) => {
            reject(new Error(`Error while loading ${url}: ${err.message}`))
        }
        xhr.send()
    })
}

export class Hole {
    constructor(position, radius) {
        this.position = position
        this.radius = radius
    }
}

export class Rect {
    constructor(topLeft, width, height) {
        this.minX = topLeft.x
        this.minY = topLeft.y
        this.maxX = topLeft.x + width
        this.maxY = topLeft.y + height
        this.width = width
        this.height = height
    }

    collideX(position, radius) {
        // If position not in Y range, skip
        if (position.y < this.minY || position.y > this.maxY) {
            return false
        }

        // X with radius is further right than left wall edge
        if (position.x + radius > this.minX) {
            if (position.x < this.maxX) {
                // X is further left than right wall edge -> collision from left
                position.x = this.minX - radius
                return true
            } else if (position.x - radius < this.maxX) {
                position.x = this.maxX + radius
                return true
            }
        }

        return false
    }

    collideY(position, radius) {
        // If position not in X range, skip
        if (position.x < this.minX || position.x > this.maxX) {
            return false
        }

        // Y with radius is further down than top wall edge
        if (position.y + radius > this.minY) {
            if (position.y < this.maxY) {
                // Y is further up than bottom wall edge -> collision from above
                position.y = this.minY - radius
                return true
            } else if (position.y - radius < this.maxY) {
                position.y = this.maxY + radius
                return true
            }
        }
    }
}
