export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const isCordova = !!device.cordova

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

    dot(vector) {
        return this.x * vector.x + this.y * vector.y
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

export const xhrRequest = async ({
    url,
    method = 'GET',
    headers = {},
    body = null,
    asArrayBuffer = false,
}) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open(method, url)
        for (const [key, value] of Object.entries(headers)) {
            xhr.setRequestHeader(key, value)
        }
        if (body) {
            xhr.setRequestHeader('Content-Type', 'application/json')
        }
        xhr.responseType = asArrayBuffer ? 'arraybuffer' : 'text'
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response)
            } else {
                reject(
                    new Error(
                        `Failed to load ${url}: ${xhr.statusText} (${xhr.status})`
                    )
                )
            }
        }
        xhr.onerror = (err) => {
            reject(new Error(`Error while loading ${url}: ${err.message}`))
        }
        xhr.send(body)
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

    collide(position, radius, velocity) {
        const closestPoint = new Vector2D(
            Math.max(this.minX, Math.min(position.x, this.maxX)),
            Math.max(this.minY, Math.min(position.y, this.maxY))
        )

        const distanceVector = position.subtract(closestPoint)
        const distance = distanceVector.magnitude()

        if (distance >= radius) return { collision: false }

        if (distance === 0) {
            const magnitude = velocity.magnitude()
            if (magnitude > 0) {
                return {
                    collision: true,
                    normal: velocity.divide(-magnitude),
                    penetration: radius,
                }
            }

            // This should not happen, player will get stuck in rect
            return {
                collision: true,
                normal: new Vector2D(0, 0),
                penetration: radius,
            }
        }

        const penetration = radius - distance

        return {
            collision: true,
            normal: distanceVector.divide(distance),
            penetration: penetration,
        }
    }
}

export const storageAvailable = () => {
    try {
        const x = '__storage_test__'
        localStorage.setItem(x, x)
        localStorage.removeItem(x)
        return true
    } catch (_) {
        return false
    }
}
