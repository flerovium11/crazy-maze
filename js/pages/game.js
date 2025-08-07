import { navigateToPage, Pages } from '../index.js'
import { sleep, Vector2D, loadImage, Images } from '../utils.js'
import { loadLevel, Levels } from '../levels.js'
import { configureAudioSettings, MarbleRollingSound, Sounds } from '../sound.js'
import { JSConfetti } from '../lib/js-confetti.browser.js'

const jsConfetti = new JSConfetti()

// Meaning viewport width and height can be max 30% of the game size
const viewportWidthFactor = 0.3
const viewportHeightFactor = 0.3
let mapWidth, mapHeight

let canvas, ctx
let gameRunning = false
let gamePaused = false
let acceleration = new Vector2D(0, 0)
let accelerationWithoutGravity = new Vector2D(0, 0)
const rollingSound = new MarbleRollingSound()
let conversionFactor
let canvasSize = new Vector2D(0, 0)

const calculateConversionFactor = () => {
    if (!ctx) {
        throw new Error('Canvas context is not initialized yet.')
    }
    // Convert from map coordinates to screen coordinates
    conversionFactor = Math.max(
        ctx.canvas.width / (mapWidth * viewportWidthFactor),
        ctx.canvas.height / (mapHeight * viewportHeightFactor)
    )
}

const handleMotion = (event) => {
    if (!gameRunning) return
    const { accelerationIncludingGravity, acceleration: eventAcceleration } =
        event
    if (accelerationIncludingGravity) {
        acceleration.x = -accelerationIncludingGravity.x || 0
        acceleration.y = accelerationIncludingGravity.y || 0
    }
    if (eventAcceleration) {
        accelerationWithoutGravity.x = -eventAcceleration.x || 0
        accelerationWithoutGravity.y = eventAcceleration.y || 0
    }
}

const handleResize = () => {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    canvasSize.x = canvas.width
    canvasSize.y = canvas.height
    calculateConversionFactor()
}

export const start = async () => {
    const homeButtons = document.getElementsByClassName('home-button')
    for (const button of homeButtons) {
        button.onclick = () => {
            document.getElementById('settings').classList.remove('visible')
            Sounds.click.start()
            navigateToPage(Pages.home)
        }
    }

    const settingsButton = document.getElementById('settings-button')
    settingsButton.onclick = () => {
        if (!gameRunning || gamePaused) return
        Sounds.click.start()
        rollingSound.stop()
        gamePaused = true
        document.getElementById('settings').classList.add('visible')
        settingsButton.setAttribute('disabled', 'true')
    }

    const resumeButton = document.getElementById('resume-game')
    resumeButton.onclick = () => {
        Sounds.click.start()
        gamePaused = false
        rollingSound.start()
        document.getElementById('settings').classList.remove('visible')
        settingsButton.removeAttribute('disabled')
    }

    configureAudioSettings()

    canvas = document.getElementById('game-canvas')
    ctx = canvas.getContext('2d')
    window.addEventListener('resize', handleResize)

    if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
        await DeviceMotionEvent.requestPermission()
            .then((response) => {
                if (response !== 'granted') {
                    alert(
                        'Device motion permission denied. Game will not use motion controls.'
                    )
                } else {
                    window.addEventListener('devicemotion', handleMotion)
                }
            })
            .catch((err) => {
                console.error('Error requesting device motion permission:', err)
                alert(
                    'An error occurred while requesting device motion permission.'
                )
                navigateToPage(Pages.home)
                return
            })
    }

    window.addEventListener('devicemotion', handleMotion, true)
    handleResize()
    gameLoop()
}

export const stop = async () => {
    gameRunning = false
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('devicemotion', handleMotion)
}

const gameLoop = async () => {
    gameRunning = true
    gamePaused = false
    if (!ctx) {
        throw new Error('Canvas context is not initialized yet.')
    }

    const targetFrameRate = 60
    const targetFrameDuration = 1000 / targetFrameRate
    let frameCount = 0

    const friction = 0.99
    const tiltInfluence = 0.1
    const shakeInfluence = 0.02
    const cameraFollowSpeed = 0.2
    const minCollisionCheckPixelResolution = 2
    const generousHoleHitboxFactor = 0.8

    // The marble does not cover the whole image in our gif frames
    const scaleMarbleFactor = 1.4

    const backgroundImage = await loadImage(Images.background)
    const holeImage = await loadImage(Images.hole)
    const goalImage = await loadImage(Images.goal)

    const marbles = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
            loadImage(`assets/images/marbles/marble${i}.gif`)
        )
    )

    const level = await loadLevel(Levels.level1)

    const playerRadius = level.playerRadius
    let visualPlayerRadius = playerRadius
    mapWidth = level.mapWidth
    mapHeight = level.mapHeight
    calculateConversionFactor()

    let playerPosition = level.startPosition.copy()
    let cameraPosition = level.startPosition.copy()
    let playerSpeed = new Vector2D(0, 0)
    let marbleIndex = 0
    let playerDiedAt = null
    let deathDirection = null
    let deathPosition = null
    let elapsedTime = 0
    let lastFrameStart = performance.now()

    const deathAnimationDuration = 300
    const minSpeedForCollisionSound = 4
    const wallBounceFactor = 0.7
    const backgroundPosition = new Vector2D(0, 0)
    const fpsDisplay = document.getElementById('fps')

    const project = (center, size) => {
        return center
            .subtract(size.divide(2))
            .subtract(cameraPosition)
            .multiply(conversionFactor)
            .add(canvasSize.divide(2))
    }

    rollingSound.start()

    while (gameRunning) {
        if (gamePaused) {
            await sleep(100)
            lastFrameStart = performance.now()
            continue
        }

        const frameStart = performance.now()
        elapsedTime += (frameStart - lastFrameStart) / 1000
        lastFrameStart = frameStart
        document.getElementById('timer').textContent = elapsedTime.toFixed(2)

        // Audio
        const intensity = playerSpeed.magnitude()
        // rollingSound.setRollSpeed(0.6 + intensity * 0.01)
        rollingSound.setVolume(intensity < 0.2 ? 0 : 0.1 + intensity * 0.1)

        // Logic
        playerSpeed = playerSpeed.multiply(friction) // Simulate friction
        playerSpeed = playerSpeed.add(acceleration.multiply(tiltInfluence))
        playerSpeed = playerSpeed.add(
            accelerationWithoutGravity.multiply(shakeInfluence)
        )

        if (!playerDiedAt) {
            let collisionIterations = Math.ceil(
                playerSpeed.magnitude() / minCollisionCheckPixelResolution
            )

            for (let i = 0; i < collisionIterations; i++) {
                playerPosition = playerPosition.add(
                    playerSpeed.divide(collisionIterations)
                )

                // Check for collisions with walls
                for (const wall of level.walls) {
                    const collision = wall.collide(
                        playerPosition,
                        playerRadius,
                        playerSpeed
                    )

                    if (!collision.collision) continue

                    const approachSpeed = -playerSpeed.dot(collision.normal)
                    if (approachSpeed > minSpeedForCollisionSound) {
                        Sounds.marbleCollision.start()
                    }

                    playerPosition = playerPosition.add(
                        collision.normal.multiply(collision.penetration)
                    )

                    const dotProduct = playerSpeed.dot(collision.normal)
                    playerSpeed = playerSpeed.subtract(
                        collision.normal.multiply(
                            2 * dotProduct * wallBounceFactor
                        )
                    )
                }
            }

            const goalDistance = playerPosition
                .subtract(level.goalPosition)
                .magnitude()
            if (goalDistance < level.goalRadius * 0.5 + playerRadius) {
                document
                    .getElementById('game-complete')
                    .classList.add('visible')
                document.getElementById('completion-time').textContent =
                    elapsedTime.toFixed(2)
                jsConfetti.addConfetti({
                    emojis: ['🏆', '🎉', '🥳'],
                })
                Sounds.gameComplete.start()
                rollingSound.stop()
                gameRunning = false
                break
            }

            // Check for collisions with holes
            for (const hole of level.holes) {
                const distance = playerPosition
                    .subtract(hole.position)
                    .magnitude()

                if (
                    distance <
                    hole.radius * generousHoleHitboxFactor - playerRadius / 2
                ) {
                    deathPosition = playerPosition.copy()
                    deathDirection = hole.position.subtract(playerPosition)
                    playerDiedAt = frameStart
                    rollingSound.stop()
                    Sounds.marbleDrop.start()
                }
            }
        } else {
            const timeSinceDeath = frameStart - playerDiedAt
            const diedPercentage = Math.sqrt(
                timeSinceDeath / deathAnimationDuration
            )

            visualPlayerRadius = playerRadius * (1 - diedPercentage * 0.8)
            playerPosition = deathPosition.add(
                deathDirection.multiply(diedPercentage)
            )

            if (timeSinceDeath >= deathAnimationDuration) {
                document.getElementById('game-over').classList.add('visible')
                Sounds.gameOver.start()
                gameRunning = false
                break
            }
        }

        // Camera follows player
        cameraPosition = cameraPosition.add(
            playerPosition.subtract(cameraPosition).multiply(cameraFollowSpeed)
        )

        // Drawing
        ctx.clearRect(0, 0, canvasSize.x, canvasSize.y)

        const backgroundProjected = project(
            backgroundPosition,
            new Vector2D(mapWidth, mapHeight)
        )

        ctx.drawImage(
            backgroundImage,
            backgroundProjected.x,
            backgroundProjected.y,
            mapWidth * conversionFactor,
            mapHeight * conversionFactor
        )

        for (const hole of level.holes) {
            const holeProjected = project(
                hole.position,
                new Vector2D(hole.radius * 2, hole.radius * 2)
            )

            ctx.drawImage(
                holeImage,
                holeProjected.x,
                holeProjected.y,
                hole.radius * 2 * conversionFactor,
                hole.radius * 2 * conversionFactor
            )
        }

        marbleIndex += playerSpeed.magnitude() * 0.1
        const marble = marbles[Math.floor(marbleIndex) % marbles.length]

        const playerProjected = project(
            playerPosition,
            new Vector2D(visualPlayerRadius, visualPlayerRadius).multiply(
                scaleMarbleFactor * 2
            )
        )

        ctx.drawImage(
            marble,
            playerProjected.x,
            playerProjected.y,
            visualPlayerRadius * 2 * conversionFactor * scaleMarbleFactor,
            visualPlayerRadius * 2 * conversionFactor * scaleMarbleFactor
        )

        const goalProjected = project(
            level.goalPosition,
            new Vector2D(level.goalRadius * 2, level.goalRadius * 2)
        )

        ctx.drawImage(
            goalImage,
            goalProjected.x,
            goalProjected.y,
            level.goalRadius * 2 * conversionFactor,
            level.goalRadius * 2 * conversionFactor
        )

        for (const wall of level.walls) {
            ctx.fillStyle = 'rgba(133, 84, 0, 1)'
            const wallProjected = project(
                new Vector2D(
                    wall.minX + wall.maxX,
                    wall.minY + wall.maxY
                ).divide(2),
                new Vector2D(wall.width, wall.height)
            )
            ctx.fillRect(
                wallProjected.x,
                wallProjected.y,
                wall.width * conversionFactor,
                wall.height * conversionFactor
            )
        }

        const frameEnd = performance.now()
        const frameTime = frameEnd - frameStart

        if (frameTime > targetFrameDuration) {
            console.warn(`Frame ${frameCount} took too long: ${frameTime}ms`)
        } else {
            await sleep(targetFrameDuration - frameTime)
        }

        if (frameCount % 50 === 0) {
            if (frameTime > targetFrameDuration) {
                fpsDisplay.textContent = (1000 / frameTime).toFixed(1) + ' FPS'
                fpsDisplay.classList.add('warning')
            } else {
                fpsDisplay.textContent = targetFrameRate + ' FPS'
                fpsDisplay.classList.remove('warning')
            }
        }

        frameCount++
    }
}
