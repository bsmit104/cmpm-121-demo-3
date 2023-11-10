// import leaflet from "leaflet";

// interface Cell {
//   readonly i: number;
//   readonly j: number;
// }

// export class Board {
//   readonly tileWidth: number;
//   readonly tileVisibilityRadius: number;

//   private readonly knownCells: Map<string, Cell>;

//   constructor(tileWidth: number, tileVisibilityRadius: number) {
//     this.tileWidth = tileWidth;
//     this.tileVisibilityRadius = tileVisibilityRadius;
//     this.knownCells = new Map();
//   }

//   private getCanonicalCell(cell: Cell): Cell {
//     const { i, j } = cell;
//     const key = [i, j].toString();
//     if (!this.knownCells.has(key)) {
//       this.knownCells.set(key, cell);
//     }
//     return this.knownCells.get(key)!;
//   }

//   getCellForPoint(point: leaflet.LatLng): Cell {
//     const i = Math.floor(point.lat / this.tileWidth);
//     const j = Math.floor(point.lng / this.tileWidth);
//     return this.getCanonicalCell({ i, j });
//   }

//   getCellBounds(cell: Cell): leaflet.LatLngBounds {
//     const minLat = cell.i * this.tileWidth;
//     const minLng = cell.j * this.tileWidth;
//     const maxLat = minLat + this.tileWidth;
//     const maxLng = minLng + this.tileWidth;
//     return leaflet.latLngBounds(
//       leaflet.latLng(minLat, minLng),
//       leaflet.latLng(maxLat, maxLng)
//     );
//   }

//   getCellsNearPoint(point: leaflet.LatLng): Cell[] {
//     const resultCells: Cell[] = [];
//     const originCell = this.getCellForPoint(point);
//     for (
//       let i = -this.tileVisibilityRadius;
//       i <= this.tileVisibilityRadius;
//       i++
//     ) {
//       for (
//         let j = -this.tileVisibilityRadius;
//         j <= this.tileVisibilityRadius;
//         j++
//       ) {
//         resultCells.push(
//           this.getCanonicalCell({ i: originCell.i + i, j: originCell.j + j })
//         );
//       }
//     }
//     return resultCells;
//   }
// }

import leaflet from "leaflet";

// Intrinsic state
class CellFlyweight {
  constructor(readonly i: number, readonly j: number) {}
}

interface Cell {
  readonly flyweight: CellFlyweight;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, CellFlyweight>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  private getCanonicalCell(i: number, j: number): CellFlyweight {
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, new CellFlyweight(i, j));
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    const flyweight = this.getCanonicalCell(i, j);
    return { flyweight };
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell.flyweight;
    const minLat = i * this.tileWidth;
    const minLng = j * this.tileWidth;
    const maxLat = minLat + this.tileWidth;
    const maxLng = minLng + this.tileWidth;
    return leaflet.latLngBounds(
      leaflet.latLng(minLat, minLng),
      leaflet.latLng(maxLat, maxLng)
    );
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point).flyweight;
    for (
      let i = -this.tileVisibilityRadius;
      i <= this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = -this.tileVisibilityRadius;
        j <= this.tileVisibilityRadius;
        j++
      ) {
        resultCells.push({
          flyweight: this.getCanonicalCell(originCell.i + i, originCell.j + j),
        });
      }
    }
    return resultCells;
  }
}
