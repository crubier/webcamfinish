import React, { useEffect, useState, useRef } from "react";

import "./App.css";

function downloadBlob(blob: Blob, filename: string = "download") {
  // Create an object URL for the blob object
  const url = URL.createObjectURL(blob);

  // Create a new anchor element
  const a = document.createElement("a");

  // Set the href and download attributes for the anchor element
  // You can optionally set other attributes like `title`, etc
  // Especially, if the anchor element will be attached to the DOM
  a.href = url;
  a.download = filename || "download";

  // Click handler that releases the object URL after the element has been clicked
  // This is required for one-off downloads of the blob content
  const clickHandler = () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.removeEventListener("click", clickHandler);
    }, 150);
  };

  // Add the click event listener on the anchor element
  // Comment out this line if you don't want a one-off download of the blob content
  a.addEventListener("click", clickHandler, false);

  // Programmatically trigger a click on the anchor element
  // Useful if you want the download to happen automatically
  // Without attaching the anchor element to the DOM
  // Comment out this line if you don't want an automatic download of the blob content
  a.click();

  // Return the anchor element
  // Useful if you want a reference to the element
  // in order to attach it to the DOM or use it in some other way
  return a;
}

function dataURItoBlob(dataURI: string): Blob {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(",")[1]);

  // separate out the mime component
  var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], { type: mimeString });
  return blob;
}

function pad(num: number, size = 4) {
  var s = "000000000" + num;
  return s.substr(s.length - size);
}

function App() {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [blocks, setBlocks] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const captureStateRef = useRef<boolean>(false);

  const initRef = useRef<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const outputCanvasRef = useRef<HTMLCanvasElement>(null);

  //////////////////////////////////////////////////////
  // Parameters of the photo finish configuration
  const direction: "Left To Right" | "Right To Left" = "Left To Right";
  const photoFinishDurationMillisecond = 15000;
  const photoFinishPixelsPerMillisecond = 1;
  const videoBoxX = 320;
  const videoBoxY = 0;
  const videoBoxWidthPixelsPerMillisecond = 0.2;
  const videoBoxHeight = 480;
  //////////////////////////////////////////////////////

  const stop = () => {
    captureStateRef.current = false;
  };

  const exportFiles = () => {
    blocks.forEach((block, index) => {
      downloadBlob(dataURItoBlob(block), `photo-finish-${pad(index)}.png`);
    });
  };

  const clear = () => {
    if (
      true ||
      confirm(
        "This will delete all photos displayed on this page! Are your sure?"
      )
    ) {
      setBlocks([]);
    }
  };

  const start = () => {
    if (
      canvasRef.current != null &&
      videoRef.current != null
      // !initRef.current
    ) {
      const video = videoRef.current;
      const canvas = canvasRef.current!;
      setIsRecording(true);
      console.log("INIT VIDEO");
      // initRef.current = true;
      captureStateRef.current = true;

      let lastTimestamp = 0;
      let lastSliceX = 0;
      let startTimestamp: number | null = null;

      canvas.width =
        photoFinishDurationMillisecond * photoFinishPixelsPerMillisecond;

      let context1 = canvas.getContext("2d");

      const doSomethingWithTheFrame = (
        timestamp: number,
        metadata: Record<string, any>
      ) => {
        if (startTimestamp === null) {
          // FIXME WARNING: Here we set the start timestamp not to the time of the button push
          // but to the timestamp of the first videoframe being recorded after that
          // It's ok for me in the prototype now, might not be later on.
          startTimestamp = timestamp;
          lastTimestamp = startTimestamp;
        }

        // Manage direction of photo finish
        let sliceX;
        let sliceWidth;
        if (direction === "Left To Right") {
          sliceX =
            ((lastTimestamp - startTimestamp) *
              photoFinishPixelsPerMillisecond) %
            (photoFinishDurationMillisecond * photoFinishPixelsPerMillisecond);
          sliceWidth =
            (timestamp - lastTimestamp) * photoFinishPixelsPerMillisecond;
        } else {
          sliceX =
            ((timestamp - startTimestamp) * photoFinishPixelsPerMillisecond) %
            (photoFinishDurationMillisecond * photoFinishPixelsPerMillisecond);
          sliceWidth =
            -(timestamp - lastTimestamp) * photoFinishPixelsPerMillisecond;
        }

        // Manage loopback, save image
        // And stop ??
        if (lastSliceX > sliceX) {
          // We are looping back, save the current image
          stop();
        }

        // actually capture the photo finish slice
        context1?.drawImage?.(
          video,
          videoBoxX,
          videoBoxY,
          (timestamp - lastTimestamp) * videoBoxWidthPixelsPerMillisecond,
          videoBoxHeight,
          sliceX,
          0,
          sliceWidth,
          canvas.height
        );

        // const frame = this.ctx1.getImageData(0, 0, this.width, this.height);
        // const length = frame.data.length;

        // for (let i = 0; i < length; i += 4) {
        //   const red = data[i + 0];
        //   const green = data[i + 1];
        //   const blue = data[i + 2];
        //   if (green > 100 && red > 100 && blue < 43) {
        //     data[i + 3] = 0;
        //   }
        // }
        // this.ctx2.putImageData(frame, 0, 0);

        lastTimestamp = timestamp;
        lastSliceX = sliceX;

        // Re-register the callback to be notified about the next frame.
        if (captureStateRef.current) {
          //@ts-ignore
          video.requestVideoFrameCallback(doSomethingWithTheFrame);
        } else {
          // canvas.width = 1000;
          const newBlock = canvas.toDataURL("image/png");
          // Finished! We clear the canvas
          canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
          setIsRecording(false);
          setBlocks((blocks) => {
            return [...blocks, newBlock];
          });
        }
      };
      // Initially register the callback to be notified about the first frame.
      //@ts-ignore
      video.requestVideoFrameCallback(doSomethingWithTheFrame);
      // setTimeout()
    }
  };

  useEffect(() => {
    if (canvasRef.current != null && videoRef.current != null) {
      const init = async () => {
        try {
          const video = videoRef.current!;
          const canvas = canvasRef.current!;
          const constraints: MediaStreamConstraints = {
            audio: false,
            video: true,
          };
          const stream: MediaStream = await navigator.mediaDevices.getUserMedia(
            constraints
          );
          video.srcObject = stream;
          const doSomethingWithTheFrame = (timestamp: number, metadata: {}) => {
            // Do something with the frame.
            // console.log(timestamp);

            // canvas.width = video.videoWidth;
            console.log("Setup video canvas, should happen once");
            canvas.width =
              photoFinishDurationMillisecond * photoFinishPixelsPerMillisecond;
            canvas.height = video.videoHeight;

            setDimensions({
              width: video.videoWidth,
              height: video.videoHeight,
            });
          };
          //@ts-ignore
          video.requestVideoFrameCallback(doSomethingWithTheFrame);
        } catch (error) {
          alert(`${error.name}: ${error.message}`);
          console.log(
            "navigator.MediaDevices.getUserMedia error: ",
            error.message,
            error.name
          );
        }
      };
      init();
    } else {
      console.warn("No refs yet in effect");
    }
  }, [canvasRef.current, videoRef.current]);

  return (
    <div id="container">
      <h1>Webcam photo finish</h1>

      <h2>
        Webcam video ({dimensions?.width}x{dimensions?.height})
      </h2>
      <video
        playsInline
        autoPlay
        ref={videoRef}
        style={{
          // visibility: "hidden",
          backgroundColor: "#000000",
          width: "320px",
          height: "240px",
        }}
      ></video>
      {isRecording ? (
        <button onClick={stop}>Stop Capture</button>
      ) : (
        <button onClick={start}>Start Capture</button>
      )}
      {blocks?.length > 0 ? (
        <>
          <button onClick={exportFiles}>Export all photos</button>
          <button onClick={clear}>Remove all photos</button>
        </>
      ) : null}

      <h2>
        Photo finish (Objects must be moving from {direction} on the camera)
      </h2>

      <canvas
        ref={canvasRef}
        style={{
          visibility: "hidden",
          display: "none",
          backgroundColor: "#000000",
          width: "100vw",
        }}
      ></canvas>

      <h2>Blocks</h2>
      {blocks.map((block, index) => (
        <img
          src={block}
          style={{ width: "100vw", height: "240px" }}
          key={index}
        />
      ))}
      {/* <canvas ref={outputCanvasRef}></canvas> */}
    </div>
  );
}

export default App;
