import _ from "lodash";
import { EIGHT_BIT_PALETTE } from "./palettes/eightBit";

let ditherValue = 0;
let pixelSize = 5;

const calculateCanvasSize = (
  canvas: HTMLCanvasElement,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } => {
  const parentDiv: HTMLElement = canvas.parentElement;
  const availableWidth: number = parentDiv.clientWidth;
  const availableHeight: number = parentDiv.clientHeight;

  const widthRatio: number = availableWidth / imageWidth;
  const heightRatio: number = availableHeight / imageHeight;

  const scaleFactor: number =
    widthRatio < heightRatio ? widthRatio : heightRatio;

  return {
    width: imageWidth * scaleFactor,
    height: imageHeight * scaleFactor
  };
};

const forRange = (start, end) => {
  return fn => {
    for (var i = start; i <= end; i++) {
      fn(i);
    }
  };
};

const getPixelLooper = (pixelSize, pixelCountX, pixelCountY) => {
  return fn => {
    forRange(0, pixelCountX - 1)(xIndex => {
      forRange(0, pixelCountY - 1)(yIndex => {
        const startX: number = xIndex * pixelSize;
        const startY: number = yIndex * pixelSize;
        fn(startX, startY, pixelSize);
      });
    });
  };
};

type RGBColor = [number, number, number];

const calculateDistanceBetweenColors = (
  colorOne: RGBColor,
  colorTwo: RGBColor
): number => {
  const redHat = (colorOne[0] + colorTwo[0]) / 2;
  const changeInRed = colorOne[0] - colorTwo[0];
  const changeInGreen = colorOne[1] - colorTwo[1];
  const changeInBlue = colorOne[2] - colorTwo[2];

  const distance = Math.sqrt(
    10 * Math.pow(changeInRed, 2) +
      4 * Math.pow(changeInGreen, 2) +
      3 * Math.pow(changeInBlue, 2) +
      (redHat * (Math.pow(changeInRed, 2) - Math.pow(changeInBlue, 2))) / 256
  );
  return distance;
};

const matchInColorSpace = (rgbColor: RGBColor) => {
  let colorChoice = null;
  let chosenColorDistance = null;
  EIGHT_BIT_PALETTE.forEach(colorToCheck => {
    if (!colorChoice) {
      colorChoice = colorToCheck;
      chosenColorDistance = calculateDistanceBetweenColors(
        rgbColor,
        colorToCheck
      );
    } else {
      const colorToCheckDistance = calculateDistanceBetweenColors(
        rgbColor,
        colorToCheck
      );
      if (colorToCheckDistance < chosenColorDistance) {
        colorChoice = colorToCheck;
        chosenColorDistance = colorToCheckDistance;
      }
    }
  });
  return colorChoice;
};

const getBrightness = (color: RGBColor): number => {
  return (color[0] + color[1] + color[2]) / 3 / 255;
};

const possiblyDither = (averageColor, closestColor) => {
  const averageColorBrightness = getBrightness(averageColor);
  const random = Math.random() / 2;
  if (averageColorBrightness - random < ditherValue) {
    return [0, 0, 0];
  } else {
    return closestColor;
  }
};

const getPixelValuesToPaint = pixelImageData => {
  const rgbArray = _.chunk(pixelImageData.data, 4).map(rgba =>
    rgba.slice(0, -1)
  ); // Remove alpha channel for now...
  const sums = rgbArray.reduce(
    (channelSums, currentPixel) => {
      return [
        channelSums[0] + currentPixel[0],
        channelSums[1] + currentPixel[1],
        channelSums[2] + currentPixel[2]
      ];
    },
    [0, 0, 0]
  );
  const average = sums.map(channelSum => channelSum / rgbArray.length);
  const closestColor = matchInColorSpace(average);
  const colorToPaint = possiblyDither(average, closestColor);
  // Then find brightness difference between average and chosen color. If above a certain threshold, (where chosen color is brighter than actual)
  // then randomly flip to black. The chance of this will be greater as the diference increases, and additionally dependent on some coeficient
  const pixelsToPaint = _.flatten(rgbArray.map(() => [...colorToPaint, 255]));
  return new Uint8ClampedArray(pixelsToPaint);
};

const convert = (): void => {
  const originCanvas: HTMLCanvasElement = document.getElementById(
    "original-canvas"
  ) as HTMLCanvasElement;
  const originContext: CanvasRenderingContext2D = originCanvas.getContext("2d");

  const pixelCountX: number = Math.floor(originCanvas.width / pixelSize);
  const pixelCountY: number = Math.floor(originCanvas.height / pixelSize);

  const targetCanvas: HTMLCanvasElement = document.getElementById(
    "target-canvas"
  ) as HTMLCanvasElement;
  const targetContext: CanvasRenderingContext2D = targetCanvas.getContext("2d");

  targetCanvas.width = pixelCountX * pixelSize;
  targetCanvas.height = pixelCountY * pixelSize;

  const forEachPixel = getPixelLooper(pixelSize, pixelCountX, pixelCountY);

  forEachPixel((startX, startY, size) => {
    const pixelImageData: ImageData = originContext.getImageData(
      startX,
      startY,
      size,
      size
    );
    const pixelsToPaint = getPixelValuesToPaint(pixelImageData);
    const imageDataToPaint = new ImageData(pixelsToPaint, pixelSize, pixelSize);
    targetContext.putImageData(imageDataToPaint, startX, startY);
  });
};

const drawImageToCanvas = (image: HTMLImageElement): void => {
  const canvas: HTMLCanvasElement = document.getElementById(
    "original-canvas"
  ) as HTMLCanvasElement;
  const canvasSize = calculateCanvasSize(canvas, image.width, image.height);
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  var context = canvas.getContext("2d");
  context.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
};

const clearCanvases = () => {
  const originalCanvas: HTMLCanvasElement = document.getElementById(
    "original-canvas"
  ) as HTMLCanvasElement;
  var originalContext = originalCanvas.getContext("2d");
  originalContext.clearRect(0, 0, originalCanvas.width, originalCanvas.height);

  const targetCanvas: HTMLCanvasElement = document.getElementById(
    "target-canvas"
  ) as HTMLCanvasElement;
  var targetContext = targetCanvas.getContext("2d");
  targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
};

const createImage = (dataUrl: string): void => {
  const image: HTMLImageElement = new Image();
  image.src = dataUrl;
  image.onload = () => drawImageToCanvas(image);
};

const readFile = (file: File): void => {
  const fileReader: FileReader = new FileReader();
  fileReader.onload = () => createImage(fileReader.result as string);
  fileReader.readAsDataURL(file);
};

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

window.addEventListener("load", () => {
  document.getElementById("pixel-size-input").onchange = (
    event: HTMLInputEvent
  ) => {
    pixelSize = parseInt(event.target.value);
    console.log(pixelSize);
  };
  document.getElementById("dither-intensity-input").onchange = (
    event: HTMLInputEvent
  ) => {
    ditherValue = parseFloat(event.target.value);
    console.log(ditherValue);
  };
  document.getElementById("pixelize-btn").onclick = () => {
    convert();
  };
  document.getElementById("file-picker").onchange = (
    event: HTMLInputEvent
  ): void => {
    clearCanvases();
    const file: File = event.target.files[0];
    readFile(file);
  };
});
