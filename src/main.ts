import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board"; // Import the Board class


class CoordinateConverter {
    coordinatesMap: Map<string, { i: number; j: number }>;

    constructor() {
        this.coordinatesMap = new Map();
    }

    convertToGameCell(latitude: number, longitude: number) {
        const i = Math.floor(latitude * 1e4);
        const j = Math.floor(longitude * 1e4);

        if (this.coordinatesMap.has(`${i}:${j}`)) {
            return this.coordinatesMap.get(`${i}:${j}`);
        }

        this.coordinatesMap.set(`${i}:${j}`, { i, j });
        return { i, j };
    }
}

// Define the base coordinates of Null Island
const NULL_ISLAND = {
    lat: 0,
    lng: 0
};

// const MERRILL_CLASSROOM = leaflet.latLng({
//     lat: 36.9995,
//     lng: - 122.0533
// });

// const UTC = leaflet.latLng({
//     lat: 36.97191,
//     lng: - 122.02593
// });

const GAMEPLAY_ZOOM_LEVEL = 19;
//const TILE_DEGREES = 0.0001;  //1e-4;
//const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;
const board = new Board(0.0001, 8);

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: NULL_ISLAND,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(NULL_ISLAND); //merril
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
    navigator.geolocation.watchPosition((position) => {
        const playerLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        playerMarker.setLatLng(playerLocation);
        map.setView(playerLocation);
        /////////
        makeCells(playerLocation);
    });
});

const moveButtonNorth = document.querySelector("#north")!;
const moveButtonSouth = document.querySelector("#south")!;
const moveButtonEast = document.querySelector("#east")!;
const moveButtonWest = document.querySelector("#west")!;

moveButtonNorth.addEventListener("click", () => movePlayer("north"));
moveButtonSouth.addEventListener("click", () => movePlayer("south"));
moveButtonEast.addEventListener("click", () => movePlayer("east"));
moveButtonWest.addEventListener("click", () => movePlayer("west"));

   
let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function makePit(i: number, j: number) {
    const bounds = leaflet.latLngBounds([
        [NULL_ISLAND.lat + i * board.tileWidth, NULL_ISLAND.lng + j * board.tileWidth],
        [NULL_ISLAND.lat + (i + 1) * board.tileWidth, NULL_ISLAND.lng + (j + 1) * board.tileWidth],
    ]);

    //const pit = leaflet.rectangle(bounds) as leaflet.Layer;
    const pit = leaflet.rectangle(bounds, {
        color: 'green',       // Change the border color to red
        fillColor: 'green',  // Change the fill color to blue
        fillOpacity: 0.5    // Set fill opacity (0.0 to 1.0)
    });


    pit.bindPopup(() => {
        const uniqueId = `${i}:${j}#${Math.floor(Math.random() * 1000)}`; // Generate a unique identifier for the pit
        let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at i: "${i},j: ${j}". It has value <span id="value">${value}</span>. Unique ID: ${uniqueId}</div>
                <button id="poke">poke</button>
                <button id="stash">stash</button>`;;
        const poke = container.querySelector<HTMLButtonElement>("#poke")!;
        poke.addEventListener("click", () => {
            value--;
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = value.toString();
            points++;
            statusPanel.innerHTML = `${points} points accumulated`;
        });
        const stash = container.querySelector<HTMLButtonElement>("#stash")!;
        stash.addEventListener("click", () => {
            if (points > 0) {
                value++;
                container.querySelector<HTMLSpanElement>("#value")!.innerHTML = value.toString();
                points--;
                statusPanel.innerHTML = `${points} points accumulated`;
            }
            else {
                alert("Not enough points");
            }
        });
        return container;
    });
    pit.addTo(map);
}

function makeCells(playerLocation: { lat: number; lng: number }) {
    const coordinateConverter = new CoordinateConverter();
    const playerCell = coordinateConverter.convertToGameCell(playerLocation.lat, playerLocation.lng);
    if (playerCell) {
        for (let i = playerCell.i - board.tileVisibilityRadius; i <= playerCell.i + board.tileVisibilityRadius; i++) {
            for (let j = playerCell.j - board.tileVisibilityRadius; j <= playerCell.j + board.tileVisibilityRadius; j++) {
                if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
                    makePit(i, j);
                }
            }
        }
    }
}

function movePlayer(direction: "north" | "south" | "east" | "west") {
    const currentLatLng = playerMarker.getLatLng();
    let newLatLng;

    switch (direction) {
        case "north":
            newLatLng = leaflet.latLng(currentLatLng.lat + board.tileWidth, currentLatLng.lng);
            break;
        case "south":
            newLatLng = leaflet.latLng(currentLatLng.lat - board.tileWidth, currentLatLng.lng);
            break;
        case "east":
            newLatLng = leaflet.latLng(currentLatLng.lat, currentLatLng.lng + board.tileWidth);
            break;
        case "west":
            newLatLng = leaflet.latLng(currentLatLng.lat, currentLatLng.lng - board.tileWidth);
            break;
    }

    playerMarker.setLatLng(newLatLng);
    map.setView(newLatLng);
    makeCells(newLatLng);
}

makeCells(NULL_ISLAND);