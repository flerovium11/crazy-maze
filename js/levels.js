import { xhrRequest } from './utils.js'
import { Vector2D, Hole, Rect } from './utils.js'
import './lib/jszip.min.js'

export class Level {
    constructor(
        holes,
        walls,
        mapWidth,
        mapHeight,
        startPosition,
        goalPosition,
        playerRadius = 7,
        goalRadius = 20
    ) {
        this.holes = holes
        this.walls = walls
        this.mapWidth = mapWidth
        this.mapHeight = mapHeight
        this.startPosition = startPosition
        this.goalPosition = goalPosition
        this.playerRadius = playerRadius
        this.goalRadius = goalRadius
    }
}

export class Levels {
    static level1 = 'assets/levels/level1.ggb'
}

const positionFromPointElement = (element) => {
    const coords = element.querySelector('coords')
    const x = parseFloat(coords.getAttribute('x'))
    const y = parseFloat(coords.getAttribute('y'))
    // Match canvas coordinate system where y increases downwards
    return new Vector2D(x, -y)
}

const levelsCache = new Map()
const zip = new JSZip()

export const loadLevel = async (src) => {
    if (levelsCache.has(src)) {
        return levelsCache.get(src)
    }

    const wallThickness = 5
    const levelFile = await xhrRequest(src, 'GET', true)
    const zipFolder = await zip.loadAsync(levelFile)
    const levelData = await zipFolder.file('geogebra.xml').async('text')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(levelData, 'text/xml')

    const pointWithLabel = (label) =>
        xmlDoc.querySelector(`element[type="point"][label="${label}"]`)

    const rectFromCommand = (command) => {
        const input = command.querySelector('input')
        const points = []

        for (let i = 0; i < 4; i++) {
            const pointLabel = input.getAttribute(`a${i}`)
            points.push(positionFromPointElement(pointWithLabel(pointLabel)))
        }

        const minX = Math.min(...points.map((p) => p.x))
        const minY = Math.min(...points.map((p) => p.y))
        const maxX = Math.max(...points.map((p) => p.x))
        const maxY = Math.max(...points.map((p) => p.y))

        return new Rect(new Vector2D(minX, minY), maxX - minX, maxY - minY)
    }

    const holeCommands = xmlDoc.querySelectorAll('command[name="Circle"]')
    const holes = Array.from(holeCommands).map((command) => {
        const input = command.querySelector('input')
        const centerPointLabel = input.getAttribute('a0')
        const radiusPointLabel = input.getAttribute('a1')
        const centerPoint = pointWithLabel(centerPointLabel)
        const radiusPoint = pointWithLabel(radiusPointLabel)

        const position = positionFromPointElement(centerPoint)
        const radiusPointPosition = positionFromPointElement(radiusPoint)
        const radius = Math.sqrt(
            (radiusPointPosition.x - position.x) ** 2 +
                (radiusPointPosition.y - position.y) ** 2
        )

        return new Hole(position, radius)
    })

    const wallCommands = xmlDoc.querySelectorAll('command[name="Segment"]')
    const walls = Array.from(wallCommands).map((command) => {
        const input = command.querySelector('input')
        const point0Label = input.getAttribute('a0')
        const point1Label = input.getAttribute('a1')
        const point0 = pointWithLabel(point0Label)
        const point1 = pointWithLabel(point1Label)

        const position0 = positionFromPointElement(point0)
        const position1 = positionFromPointElement(point1)

        if (position0.x === position1.x && position0.y === position1.y) {
            throw new Error(
                `Wall segment from ${point0Label} to ${point1Label} has zero length.`
            )
        }

        if (position0.x !== position1.x && position0.y !== position1.y) {
            throw new Error(
                `Wall segment from ${point0Label} to ${point1Label} is not horizontal or vertical.`
            )
        }

        const point0IsFirst =
            position0.x < position1.x || position0.y < position1.y
        const startCoords = point0IsFirst ? position0 : position1
        const endCoords = point0IsFirst ? position1 : position0

        const width = endCoords.x - startCoords.x
        const height = endCoords.y - startCoords.y

        if (width < 0 || height < 0) {
            throw new Error(
                `Wall segment from ${point0Label} to ${point1Label} has negative dimensions.`
            )
        }

        return new Rect(
            startCoords,
            width || wallThickness,
            height || wallThickness
        )
    })

    const mapRectCommand = xmlDoc.querySelector('command[name="Polygon"]')
    const mapRect = rectFromCommand(mapRectCommand)
    const mapWidth = mapRect.maxX - mapRect.minX
    const mapHeight = mapRect.maxY - mapRect.minY
    walls.push(
        new Rect(
            new Vector2D(mapRect.minX, mapRect.minY),
            mapWidth,
            wallThickness
        ),
        new Rect(
            new Vector2D(mapRect.minX, mapRect.maxY),
            mapWidth,
            wallThickness
        ),
        new Rect(
            new Vector2D(mapRect.minX, mapRect.minY),
            wallThickness,
            mapHeight
        ),
        new Rect(
            new Vector2D(mapRect.maxX, mapRect.minY),
            wallThickness,
            mapHeight
        )
    )

    const startingPoint = pointWithLabel('START')
    const startPosition = positionFromPointElement(startingPoint)

    const goalPoint = pointWithLabel('GOAL')
    const goalPosition = positionFromPointElement(goalPoint)

    const level = new Level(
        holes,
        walls,
        mapWidth,
        mapHeight,
        startPosition,
        goalPosition
    )

    levelsCache.set(src, level)
    return level
}
