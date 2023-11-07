import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board";
import L from "leaflet";

class Pit {
  i: number;
  j: number;
  value: number;

  constructor(i: number, j: number) {
    this.i = i;
    this.j = j;
    this.value = 0;
  }

  toMomento() {
    return JSON.stringify({
      i: this.i,
      j: this.j,
      value: this.value,
    });
  }

  fromMomento(momento: string) {
    const state = JSON.parse(momento);
    this.i = state.i;
    this.j = state.j;
    this.value = state.value;
  }
}

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

const NULL_ISLAND = {
  lat: 0,
  lng: 0,
};

const GAMEPLAY_ZOOM_LEVEL = 19;
const PIT_SPAWN_PROBABILITY = 0.1;
const board = new Board(0.0001, 8);

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

const jawgMatrix = L.tileLayer(
  "https://{s}.tile.jawg.io/jawg-matrix/{z}/{x}/{y}{r}.png?access-token=7rMerZfyOYSNVJDYwxCmNT23wwnRLjWy31QL5mGJ1NJZwbY3TaGJXra0sRVVWWi7",
  {
    attribution:
      '<a href="http://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22,
    subdomains: "abcd",
  }
);

jawgMatrix.addTo(map);

// leaflet
//   .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//     maxZoom: 19,
//     attribution:
//       '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
//   })
//   .addTo(map);

const playerMarker = leaflet.marker(NULL_ISLAND); // Initialize player at Null Island
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    const playerLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    playerMarker.setLatLng(playerLocation);
    map.setView(playerLocation);

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

const pits: Pit[] = [];

function makePit(i: number, j: number, initialValue: number) {
  const pit = new Pit(i, j);
  pit.value = initialValue;
  pits.push(pit);
  const bounds = leaflet.latLngBounds([
    [
      NULL_ISLAND.lat + i * board.tileWidth,
      NULL_ISLAND.lng + j * board.tileWidth,
    ],
    [
      NULL_ISLAND.lat + (i + 1) * board.tileWidth,
      NULL_ISLAND.lng + (j + 1) * board.tileWidth,
    ],
  ]);

  const pitDisplay = leaflet.rectangle(bounds, {
    color: "green",
    fillColor: "green",
    fillOpacity: 0.5,
  });

  pitDisplay.bindPopup(() => {
    const uniqueId = `${i}:${j}#${Math.floor(Math.random() * 1000)}`;
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at i: "${i}, j: ${j}". It has value <span id="value">${value}</span>. Unique ID: ${uniqueId}</div>
                <button id="poke">poke</button>
                <button id="stash">stash</button>`;
    const poke = container.querySelector<HTMLButtonElement>("#poke")!;
    poke.addEventListener("click", () => {
      value--;
      container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
        value.toString();
      points++;
      statusPanel.innerHTML = `${points} points accumulated`;

      pit.value = value;

      savePitsState();
      restorePitsState();
    });
    const stash = container.querySelector<HTMLButtonElement>("#stash")!;
    stash.addEventListener("click", () => {
      if (points > 0) {
        value++;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        points--;
        statusPanel.innerHTML = `${points} points accumulated`;

        pit.value = value;

        savePitsState();
        restorePitsState();
      } else {
        alert("Not enough points");
      }
    });
    return container;
  });
  pitDisplay.addTo(map);
}

function makeCells(playerLocation: { lat: number; lng: number }) {
  const coordinateConverter = new CoordinateConverter();
  const playerCell = coordinateConverter.convertToGameCell(
    playerLocation.lat,
    playerLocation.lng
  );
  if (playerCell) {
    for (
      let i = playerCell.i - board.tileVisibilityRadius;
      i <= playerCell.i + board.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = playerCell.j - board.tileVisibilityRadius;
        j <= playerCell.j + board.tileVisibilityRadius;
        j++
      ) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
          const initialValue = Math.floor(Math.random() * 10) + 1;
          makePit(i, j, initialValue);
        }
      }
    }
  }
}

function savePitsState() {
  const pitStates = pits.map((pit) => {
    return pit.toMomento();
  });
  localStorage.setItem("pitsState", JSON.stringify(pitStates));
}

function restorePitsState() {
  const pitStates = JSON.parse(localStorage.getItem("pitsState") || "[]");
  pits.length = 0;
  pitStates.forEach((momento: string) => {
    const pitData = JSON.parse(momento);

    console.log("Restored pitData:", pitData);
    const pit = new Pit(pitData.i, pitData.j);
    pit.fromMomento(momento);

    console.log("Restored pit.value:", pit.value);

    pit.value = pitData.value;
    pits.push(pit);
  });
}

restorePitsState();

setInterval(() => {
  savePitsState();
}, 1);

function movePlayer(direction: "north" | "south" | "east" | "west") {
  const currentLatLng = playerMarker.getLatLng();
  let newLatLng;

  switch (direction) {
    case "north":
      newLatLng = leaflet.latLng(
        currentLatLng.lat + board.tileWidth,
        currentLatLng.lng
      );
      break;
    case "south":
      newLatLng = leaflet.latLng(
        currentLatLng.lat - board.tileWidth,
        currentLatLng.lng
      );
      break;
    case "east":
      newLatLng = leaflet.latLng(
        currentLatLng.lat,
        currentLatLng.lng + board.tileWidth
      );
      break;
    case "west":
      newLatLng = leaflet.latLng(
        currentLatLng.lat,
        currentLatLng.lng - board.tileWidth
      );
      break;
  }

  playerMarker.setLatLng(newLatLng);
  map.setView(newLatLng);
  makeCells(newLatLng);
}

// initial pits around Null Island
makeCells(NULL_ISLAND);
