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
      coins: this.coins,
    });
  }

  fromMomento(momento: string) {
    const state = JSON.parse(momento);
    this.i = state.i;
    this.j = state.j;
    this.value = state.value;
    this.coins = state.coins || [];
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

let playerMovementHistory: leaflet.LatLng[] = [];
let playerMovementPolyline: leaflet.Polyline | null = null;
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

let autoUpdatePosition = false;
let watchId: number | null = null;

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  if (autoUpdatePosition) {
    // If automatic updating is already enabled, disable it
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    autoUpdatePosition = false;
  } else {
    // If automatic updating is not enabled, enable it
    watchId = navigator.geolocation.watchPosition((position) => {
      const playerLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      playerMarker.setLatLng(playerLocation);
      map.setView(playerLocation);

      makeCells(playerLocation);
      //updateGameState();
    });

    autoUpdatePosition = true;
  }
});
/////////////update location on press/////////////////
// const sensorButton = document.querySelector("#sensor")!;
// sensorButton.addEventListener("click", () => {
//   navigator.geolocation.watchPosition((position) => {
//     const playerLocation = {
//       lat: position.coords.latitude,
//       lng: position.coords.longitude,
//     };

//     playerMarker.setLatLng(playerLocation);
//     map.setView(playerLocation);

//     makeCells(playerLocation);
//     //updateGameState();
//   });
// });

const moveButtonNorth = document.querySelector("#north")!;
const moveButtonSouth = document.querySelector("#south")!;
const moveButtonEast = document.querySelector("#east")!;
const moveButtonWest = document.querySelector("#west")!;

moveButtonNorth.addEventListener("click", () => movePlayer("north"));
moveButtonSouth.addEventListener("click", () => movePlayer("south"));
moveButtonEast.addEventListener("click", () => movePlayer("east"));
moveButtonWest.addEventListener("click", () => movePlayer("west"));

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => resetGame());

function resetGame() {
  // Ask the user for confirmation
  const userConfirmation = prompt(
    "Are you sure you want to delete your history? (yes/no)"
  );

  // Check if the user confirmed the reset
  if (userConfirmation && userConfirmation.toLowerCase() === "yes") {
    // Remove existing pits from the map
    pits.forEach((pit) => {
      const bounds = leaflet.latLngBounds([
        [
          NULL_ISLAND.lat + pit.i * board.tileWidth,
          NULL_ISLAND.lng + pit.j * board.tileWidth,
        ],
        [
          NULL_ISLAND.lat + (pit.i + 1) * board.tileWidth,
          NULL_ISLAND.lng + (pit.j + 1) * board.tileWidth,
        ],
      ]);

      // Use eachLayer to iterate over the layers within the bounds and remove them
      map.eachLayer((layer) => {
        if (layer instanceof leaflet.Rectangle) {
          const layerBounds = layer.getBounds();
          if (layerBounds.equals(bounds)) {
            map.removeLayer(layer);
          }
        }
      });
    });

    // Clear the pits array
    pits.length = 0;

    // Clear the movement history
    playerMovementHistory = [];
    renderMovementHistory();

    // Reset the player marker to Null Island
    playerMarker.setLatLng(NULL_ISLAND);
    map.setView(NULL_ISLAND);

    // Reset points and inventory
    console.log("bitch");
    points = 0;
    inventory = [];
    statusPanel.innerHTML = "No points yet...";

    // Save the reset state to local storage
    saveGameState();

    // Reload the initial pits around Null Island
    makeCells(NULL_ISLAND);
  } else {
    // If the user didn't confirm, do nothing or provide feedback
    alert("Game state reset canceled.");
  }
}

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

const coinImages = [
  "src/assets/ASlime.png",
  "src/assets/BSlime.png",
  "src/assets/CSlime.png",
  "src/assets/DSlime.png",
  "src/assets/ESlime.png",
  "src/assets/FSlime.png",
  "src/assets/GSlime.png",
  "src/assets/HSlime.png",
  "src/assets/ISlime.png",
  "src/assets/JSlime.png",
  "src/assets/KSlime.png",
  "src/assets/OSlime.png",
  "src/assets/PSlime.png",
  "src/assets/QSlime.png",
  "src/assets/SSlime.png",
  "src/assets/TSlime.png",
  "src/assets/USlime.png",
  "src/assets/VSlime.png",
  "src/assets/WSlime.png",
  "src/assets/XSlime.png",
  "src/assets/YSlime.png",
  "src/assets/ZSlime.png",
];

const boardSize = 0.0001;
function makePit(i: number, j: number, initialValue: number) {
  let numCoins = 0;
  let pit = new Pit(i, j);
  const existingPitIndex = pits.findIndex(
    (pit) => Math.abs(pit.i - i) < boardSize && Math.abs(pit.j - j) < boardSize
  );

  if (existingPitIndex !== -1) {
    //console.log("Pit already exists at this location");
    pit = pits[existingPitIndex];

    pit.value = initialValue;
    pit.coins = pits[existingPitIndex].coins;
  } else {
    //console.log("Creating pit at", i, j);
    pit.value = initialValue;
    pits.push(pit);
    pit.coins = [];
    // 1 to 4 coins in the pit
    numCoins = Math.floor(Math.random() * 4) + 1;
    for (let serial = 0; serial < numCoins; serial++) {
      pit.coins.push({ i, j, serial });
    }
  }
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

  numCoins = pit.coins.length;

  pitDisplay.bindPopup(() => {
    const container = document.createElement("div");
    const coinDescriptions = pit.coins.map((coin) => {
      const uniqueId = `${coin.i}:${coin.j}#${coin.serial}`;
      const randomImage =
        coinImages[Math.floor(Math.random() * coinImages.length)];
      return `
        <div id="coin-${coin.serial}">
          <img src="${randomImage}" alt="Coin" style="width: 20px; height: 20px; margin-right: 5px;">
          Coin ID: ${uniqueId}
        </div>
      `;
      // return `
      //   <div id="coin-${coin.serial}">
      //     <img src="src/assets/nightSlime.png" alt="Coin" style="width: 20px; height: 20px; margin-right: 5px;">
      //     Coin ID: ${uniqueId}
      //   </div>
      // `;
      // return `
      //   <div id="coin-${coin.serial}">Coin ID: ${uniqueId}</div>
      // `;
    });

    container.innerHTML = `
      <div>There is a pit here at i: "${i}, j: ${j}". It contains <span id="numCoins">${numCoins}</span></div>
      <span id="coinDes">${coinDescriptions.join("")}</span>
      <button id="poke">poke</button>
      <button id="stash">stash</button>`;
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
        savePitsState();
        updateGameState();
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
          savePitsState();
          updateGameState();
        }
      }
    });
    return container;
  });

  pitDisplay.addTo(map);
}

// Load inventory and points from local storage
const storedInventory = localStorage.getItem("inventory");
const storedPoints = localStorage.getItem("points");

if (storedInventory) {
  inventory = JSON.parse(storedInventory);
}

if (storedPoints) {
  points = parseInt(storedPoints, 10);
  statusPanel.innerHTML = `${points} points accumulated`;
}

// Save game state to local storage
function saveGameState() {
  localStorage.setItem("inventory", JSON.stringify(inventory));
  localStorage.setItem("points", points.toString());
  savePitsState();
}

// starting pits around Null Island
makeCells(NULL_ISLAND);

function updateGameState() {
  saveGameState();
  //makeCells(playerMarker.getLatLng());
}

function loadPitsState() {
  const pitStatesString = localStorage.getItem("pitsState");
  if (pitStatesString) {
    try {
      const pitStates = JSON.parse(pitStatesString);
      pits.length = 0; // Clear existing pits

      pitStates.forEach((pitState: string) => {
        const state = JSON.parse(pitState);

        if (
          typeof state.i === "number" &&
          !isNaN(state.i) &&
          typeof state.j === "number" &&
          !isNaN(state.j)
        ) {
          const pit = new Pit(state.i, state.j);
          pit.fromMomento(pitState);
          pits.push(pit);

          if (state.coins) {
            pit.coins = state.coins;
          }

          makePit(pit.i, pit.j, pit.value);
        } else {
          console.warn("Invalid coordinates in pit state:", state);
        }
      });
    } catch (error) {
      //chat gpt error catching recommendation
      console.error("Error loading pits state:", error);
    }
  }
}

function savePitsState() {
  const pitStates = pits.map((pit) => {
    return pit.toMomento();
  });
  localStorage.setItem("pitsState", JSON.stringify(pitStates));
}

loadPitsState();

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
        //console.log("create pit at location:", i, j);
        makePit(i, j, initialValue);
      }
      // map.addEventListener("click", () => centerMapOnCell(i, j));
    });
  }
}

// function centerMapOnCell(i: number, j: number) {
//   const centerLat = NULL_ISLAND.lat + (i + 0.5) * board.tileWidth;
//   const centerLng = NULL_ISLAND.lng + (j + 0.5) * board.tileWidth;

//   map.setView([centerLat, centerLng]);
// }

function renderMovementHistory() {
  playerMovementPolyline?.remove();

  playerMovementPolyline = leaflet.polyline(playerMovementHistory, {
    color: "blue",
    weight: 3,
    opacity: 0.7,
  });

  playerMovementPolyline.addTo(map);
}

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

  playerMovementHistory.push(currentLatLng);

  if (playerMovementHistory.length > 100) {
    playerMovementHistory.shift();
  }

  renderMovementHistory();

  makeCells(newLatLng);
}

// // initial pits around Null Island
// makeCells(NULL_ISLAND);
