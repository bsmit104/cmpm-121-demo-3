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
  coins: Coin[];

  constructor(i: number, j: number) {
    this.i = i;
    this.j = j;
    this.value = 0;
    this.coins = [];
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

interface Coin {
  i: number;
  j: number;
  serial: number;
}

let inventory: string[] = [];

//const pitPopups = new Map<Pit, leaflet.Popup>();
function updatePitPopup(pit: Pit, pitDisplay: leaflet.Rectangle) {
  const container = document.createElement("div");
  let numCoins = pit.value;

  const coinDescriptions = pit.coins.map((coin) => {
    const uniqueId = `${coin.i}:${coin.j}#${coin.serial}`;
    return `
      <div id="coin-${coin.serial}">Coin ID: ${uniqueId}</div>
    `;
  });

  container.innerHTML = `
    <div>There is a pit here at i: "${pit.i}, j: ${
    pit.j
  }". It contains ${numCoins} </div>
    ${coinDescriptions.join("")}
    <button id="poke">poke</button>
    <button id="stash">stash</button>`;

  pitDisplay.bindPopup(() => {
    return container;
  });
}

function makePit(i: number, j: number, initialValue: number) {
  const pit = new Pit(i, j);
  pit.value = initialValue;
  pits.push(pit);
  pit.coins = [];
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

  //const coins: Coin[] = []; // Array to hold coins in the pit

  // 1 to 4 coins in the pit
  let numCoins = Math.floor(Math.random() * 4) + 1;
  for (let serial = 0; serial < numCoins; serial++) {
    pit.coins.push({ i, j, serial });
  }

  //let numCoinsText = numCoins;

  pitDisplay.bindPopup(() => {
    const container = document.createElement("div");
    //let numCoins = pit.value;
    const coinDescriptions = pit.coins.map((coin) => {
      const uniqueId = `${coin.i}:${coin.j}#${coin.serial}`;
      return `
        <div id="coin-${coin.serial}">Coin ID: ${uniqueId}</div>
      `;
    });

    container.innerHTML = `
      <div>There is a pit here at i: "${i}, j: ${j}". It contains <span id="numCoins">${numCoins}</span></div>
      <span id="coinDes">${coinDescriptions.join("")}</span>
      <button id="poke">poke</button>
      <button id="stash">stash</button>`;
    updatePitPopup(pit, pitDisplay);
    const poke = container.querySelector<HTMLButtonElement>("#poke")!;
    poke.addEventListener("click", () => {
      console.log("clicked");
      if (numCoins > 0) {
        numCoins--;
        points++;
        statusPanel.innerHTML = `${points} points accumulated`;

        const coin = { i, j, serial: pit.coins.length - 1 };
        inventory.push(`${i}:${j}#${coin.serial}`);

        console.log("Inventory:", inventory);

        pit.coins.pop();
        pit.value = numCoins;

        // Update coinDescriptions
        const coinDescriptions = pit.coins.map((coin) => {
          const uniqueId = `${coin.i}:${coin.j}#${coin.serial}`;
          return `
        <div id="coin-${coin.serial}">Coin ID: ${uniqueId}</div>
      `;
        });

        container.querySelector<HTMLSpanElement>("#numCoins")!.innerHTML =
          numCoins.toString();
        container.querySelector<HTMLSpanElement>("#coinDes")!.innerHTML =
          coinDescriptions.join("").toString();
        //updatePitPopup(pit, pitDisplay);
      }
    });

    const stash = container.querySelector<HTMLButtonElement>("#stash")!;
    stash.addEventListener("click", () => {
      console.log("stash clicked");
      if (inventory.length > 0) {
        const coinIdentifier = inventory.pop();

        if (coinIdentifier) {
          //const [i, j, serial] = coinIdentifier.split(":").map(Number);
          const [ij, coinSerial] = coinIdentifier.split("#");
          const [i, j] = ij.split(":").map(Number);
          const serial = Number(coinSerial);

          pit.coins.push({ i, j, serial });

          console.log("Inventory:", inventory);
          console.log("coins:", inventory);

          numCoins++;
          points--;
          statusPanel.innerHTML = `${points} points accumulated`;
          pit.value = numCoins;

          const coinDescriptions = pit.coins.map((coin) => {
            const uniqueId = `${coin.i}:${coin.j}#${coin.serial}`;
            return `
          <div id="coin-${coin.serial}">Coin ID: ${uniqueId}</div>
        `;
          });

          container.querySelector<HTMLSpanElement>("#numCoins")!.innerHTML =
            numCoins.toString();
          container.querySelector<HTMLSpanElement>("#coinDes")!.innerHTML =
            coinDescriptions.join("").toString();
          //updatePitPopup(pit, pitDisplay);
        }
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
    const playerLatLng = leaflet.latLng(playerLocation.lat, playerLocation.lng);
    const visibleCells = board.getCellsNearPoint(playerLatLng);

    visibleCells.forEach((cell) => {
      const i = cell.flyweight.i;
      const j = cell.flyweight.j;

      if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
        const initialValue = Math.floor(Math.random() * 10) + 1;
        makePit(i, j, initialValue);
      }
    });
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

setInterval(() => {
  savePitsState();
}, 0.01);

restorePitsState();

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
