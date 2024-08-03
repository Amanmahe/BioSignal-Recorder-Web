"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Cable,
  Circle,
  CircleStop,
  CircleX,
  FileArchive,
  FileDown,
  Infinity,
} from "lucide-react";
import { vendorsList } from "./vendors";
import { BoardsList } from "./UDL_Boards";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { BitSelection } from "./DataPass";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Separator } from "./ui/separator";
import { Switch } from "../components/ui/switch";
import {
  initDB,
  addToBuffer,
  getBuffer,
  clearBuffer,
  addToDataset,
  getAllDatasets,
  clearAllDatasets,
  getDatasetCount,
} from "../lib/indexedDB";

interface ConnectionProps {
  LineData: Function;
  Connection: (isConnected: boolean) => void;
  selectedBits: BitSelection;
  setSelectedBits: React.Dispatch<React.SetStateAction<BitSelection>>;
}

const columnNames = [
  "Counter",
  "Channel 1",
  "Channel 2",
  "Channel 3",
  "Channel 4",
  "Channel 5",
  "Channel 6",
];

const Connection: React.FC<ConnectionProps> = ({
  LineData,
  Connection,
  selectedBits,
  setSelectedBits,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const [detectedBits, setDetectedBits] = useState<BitSelection | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [customTime, setCustomTime] = useState<string>("");
  const endTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const localBufferRef = useRef<string[][]>([]);

  // const [missedDataCount, setMissedDataCount] = useState<number>(0);
  // const lastCounterRef = useRef<number>(-1);
  // const dataRateWindowRef = useRef<number[]>([]);
  const [recordingsCount, setRecordingsCount] = useState<number>(0);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<
    ReadableStreamDefaultReader<Uint8Array> | null | undefined
  >(null);

  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    initDB()
      .then(() => {
        setDbInitialized(true);
      })
      .catch((error) => {
        toast.error(
          "Failed to initialize data storage. Some features may not work."
        );
      });
  }, []);

  useEffect(() => {
    const updateRecordingsCount = async () => {
      const count = await getDatasetCount();
      setRecordingsCount(count);
    };

    updateRecordingsCount();
  }, [isRecording]);

  const handleTimeSelection = (minutes: number | null) => {
    if (minutes === null) {
      endTimeRef.current = null;
      toast.success("Recording set to no time limit");
    } else {
      const newEndTimeSeconds = minutes * 60;
      if (newEndTimeSeconds <= elapsedTime) {
        toast.error("End time must be greater than the current elapsed time");
      } else {
        endTimeRef.current = newEndTimeSeconds;
        toast.success(`Recording end time set to ${minutes} minutes`);
      }
    }
  };

  const handleCustomTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setCustomTime(value);
  };

  const handleCustomTimeSet = () => {
    const time = parseInt(customTime);
    if (!isNaN(time) && time > 0) {
      handleTimeSelection(time);
    } else {
      toast.error("Please enter a valid time in minutes");
    }
    setCustomTime("");
  };

  const formatPortInfo = useCallback(
    (info: SerialPortInfo) => {
      if (!info || !info.usbVendorId) {
        return "Port with no info";
      }

      // First, check if the board exists in BoardsList
      const board = BoardsList.find(
        (b) => parseInt(b.field_pid) === info.usbProductId
      );
      if (board) {
        setDetectedBits(board.bits as BitSelection);
        setSelectedBits(board.bits as BitSelection);
        return `${board.name} | Product ID: ${info.usbProductId}`;
      }

      setDetectedBits(null);

      // If not found in BoardsList, fall back to the vendor check
      const vendorName =
        vendorsList.find((d) => parseInt(d.field_vid) === info.usbVendorId)
          ?.name ?? "Unknown Vendor";
      return `${vendorName} | Product ID: ${info.usbProductId}`;
    },
    [setSelectedBits]
  );

  const handleClick = () => {
    if (isConnected) {
      disconnectDevice();
    } else {
      connectToDevice();
    }
  };

  const connectToDevice = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      Connection(true);
      setIsConnected(true);
      isConnectedRef.current = true;
      portRef.current = port;
      toast.success("Connection Successfull", {
        description: (
          <div className="mt-2 flex flex-col space-y-1">
            <p>Device: {formatPortInfo(portRef.current.getInfo())}</p>
            <p>Baud Rate: 115200</p>
          </div>
        ),
      });
      const reader = port.readable?.getReader();
      readerRef.current = reader;
      readData();
      await navigator.wakeLock.request("screen");
    } catch (error) {
      disconnectDevice();
      isConnectedRef.current = false;
      setIsConnected(false);
      console.error("Error connecting to device:", error);
    }
  };

  const disconnectDevice = async (): Promise<void> => {
    try {
      if (portRef.current && portRef.current.readable) {
        if (readerRef.current) {
          await readerRef.current.cancel();
          readerRef.current.releaseLock();
        }
        await portRef.current.close();
        portRef.current = null;
        toast("Disconnected from device", {
          action: {
            label: "Reconnect",
            onClick: () => connectToDevice(),
          },
        });
      }
    } catch (error) {
      console.error("Error during disconnection:", error);
    } finally {
      setIsConnected(false);
      Connection(false);
      isConnectedRef.current = false;
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const readData = async (): Promise<void> => {
    const decoder = new TextDecoder();
    let lineBuffer = "";
    while (isConnectedRef.current) {
      try {
        const StreamData = await readerRef.current?.read();
        if (StreamData?.done) {
          console.log("Thank you for using our app!");
          break;
        }
        const receivedData = decoder.decode(StreamData?.value, {
          stream: true,
        });
        const lines = (lineBuffer + receivedData).split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const dataValues = line.split(",");
          if (dataValues.length === 1) {
            // toast(`Received Data: ${line}`);
          } else {
            LineData(dataValues);
            if (isRecordingRef.current) {
              localBufferRef.current.push(dataValues);
              console.log(localBufferRef.current);
              // if (localBufferRef.current.length >= 0) {
              //   addToBuffer(localBufferRef.current);
              //   localBufferRef.current = [];
              // }
            }
          }
        }
      } catch (error) {
        console.error("Error reading from device:", error);
        break;
      }
    }
    await disconnectDevice();
  };

  // const processData = useCallback(
  //   (dataValues: string[]) => {
  //     const now = Date.now();
  //     const [counter, ...sensorValues] = dataValues.map(Number);

  //     // Sequence number analysis
  //     if (
  //       lastCounterRef.current !== -1 &&
  //       counter !== (lastCounterRef.current + 1) % 256
  //     ) {
  //       console.log(
  //         `Non-sequential counter: expected ${
  //           (lastCounterRef.current + 1) % 256
  //         }, got ${counter}`
  //       );
  //       setMissedDataCount((prev) => prev + 1);
  //     }
  //     lastCounterRef.current = counter;

  //     // Data rate monitoring
  //     dataRateWindowRef.current.push(now);
  //     if (dataRateWindowRef.current.length > 250) {
  //       const oldestTimestamp = dataRateWindowRef.current.shift()!;
  //       const dataRate = 250000 / (now - oldestTimestamp);
  //       if (dataRate < 248) {
  //         // Allow for small fluctuations
  //         console.log(
  //           `Data rate too low: ${dataRate.toFixed(2)} samples/second`
  //         );
  //         setMissedDataCount((prev) => prev + 1);
  //       }
  //     }

  //     LineData(dataValues);
  //     if (missedDataCount > 0) {
  //       console.log(
  //         `Missed data events in the last second: ${missedDataCount}`
  //       );
  //       setMissedDataCount(0);
  //     }
  //   },
  //   [LineData, missedDataCount]
  // );

  const convertToCSV = (buffer: string[][]): string => {
    const headerRow = columnNames.join(",");
    const rows = buffer.map((row) => row.map(Number).join(","));
    const csvData = [headerRow, ...rows].join("\n");
    return csvData;
  };

  const handleRecord = async () => {
    if (!dbInitialized) {
      toast.error("Data storage is not ready. Please try again in a moment.");
      return;
    }

    if (isConnected) {
      if (isRecording) {
        await stopRecording();
      } else {
        try {
          setIsRecording(true);
          isRecordingRef.current = true;
          const now = new Date();
          const nowTime = now.getTime();
          startTimeRef.current = nowTime;
          setElapsedTime(0);
          timerIntervalRef.current = setInterval(checkRecordingTime, 1000);
          await clearBuffer(); // Clear the buffer when starting a new recording
        } catch (error) {
          toast.error("Failed to start recording. Please try again.");
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      }
    } else {
      toast.warning("No device is connected");
    }
  };

  const checkRecordingTime = () => {
    setElapsedTime((prev) => {
      const newElapsedTime = prev + 1;
      if (endTimeRef.current !== null && newElapsedTime >= endTimeRef.current) {
        stopRecording();
        return endTimeRef.current;
      }
      return newElapsedTime;
    });
  };

  const formatDuration = (durationInSeconds: number): string => {
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    if (minutes === 0) {
      return `${seconds} second${seconds !== 1 ? "s" : ""}`;
    }
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ${seconds} second${
      seconds !== 1 ? "s" : ""
    }`;
  };

  const stopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (startTimeRef.current === null) {
      toast.error("Start time was not set properly.");
      return;
    }

    const endTime = new Date();
    const endTimeString = endTime.toLocaleTimeString();
    const startTimeString = new Date(startTimeRef.current).toLocaleTimeString();
    const durationInSeconds = Math.round(
      (endTime.getTime() - startTimeRef.current) / 1000
    );

    // if (bufferRef.current.length > 0) {
    //   const data = [...bufferRef.current]; // Create a copy of the current buffer
    //   setDatasets((prevDatasets) => {
    //     const newDatasets = [...prevDatasets, data];
    //     return newDatasets;
    //   });

    //   bufferRef.current = []; // Clear the buffer ref
    // }

    const bufferData = await getBuffer();
    await addToDataset(bufferData);
    await clearBuffer();

    const allData = await getAllDatasets();

    toast.success("Recording completed Successfully", {
      description: (
        <div className="mt-2 flex flex-col space-y-1">
          <p>Start Time: {startTimeString}</p>
          <p>End Time: {endTimeString}</p>
          <p>Recording Duration: {formatDuration(durationInSeconds)}</p>
          <p>Stored Recorded Files: {allData.length}</p>
        </div>
      ),
    });

    setIsRecording(false);
    isRecordingRef.current = false;

    startTimeRef.current = null;
    endTimeRef.current = null;
    setElapsedTime(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const saveData = async () => {
    try {
      const datasetCount = await getDatasetCount();
      setRecordingsCount(datasetCount);

      if (datasetCount === 0) {
        toast.error("No data available to download.");
        return;
      }

      const allDatasets = await getAllDatasets();

      if (datasetCount === 1) {
        // Single file download as CSV
        const csvData = convertToCSV(allDatasets[0]);
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
        saveAs(blob, "data.csv");
      } else {
        // Multiple files download as ZIP
        const zip = new JSZip();

        allDatasets.forEach((dataset, index) => {
          const csvData = convertToCSV(dataset);
          zip.file(`data${index + 1}.csv`, csvData);
        });

        const zipContent = await zip.generateAsync({ type: "blob" });
        saveAs(zipContent, "datasets.zip");
      }

      // Clear the datasets after saving
      await clearAllDatasets();
      toast.success("Data saved successfully.");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("An error occurred while saving data.");
    }
  };

  const writeData = async (data: string) => {
    try {
      if (isConnected && portRef.current && portRef.current.writable) {
        const writer = portRef.current.writable.getWriter();
        const encoder = new TextEncoder();
        const dataToSend = encoder.encode(`${data}\n`);
        await writer.write(dataToSend);
        writer.releaseLock();
      } else {
        toast.error("No device is connected");
      }
    } catch (error) {
      console.error("Error writing data to device:", error);
    }
  };

  return (
    <div className="flex h-14 items-center justify-between px-4">
      <div className="flex-1">
        {isRecording && (
          <div className="flex justify-center items-center space-x-1 w-min">
            <div className="font-medium p-2 w-16 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm ring-offset-background transition-colors bg-primary text-destructive hover:bg-primary/90">
              {formatTime(elapsedTime)}
            </div>
            <Separator orientation="vertical" className="bg-primary h-9" />
            <div className="">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button
                    className="text-lg w-auto h-9 font-medium"
                    variant="destructive"
                  >
                    {endTimeRef.current === null ? (
                      // <Infinity className="h-5 w-5 text-primary" />
                      <span className="text-xs">Set End Time</span>
                    ) : (
                      <div className="text-sm text-primary font-medium">
                        {formatTime(endTimeRef.current)}
                      </div>
                    )}
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent className="w-64 p-4" side="right">
                  <div className="flex flex-col space-y-4">
                    <div className="text-sm font-medium">
                      Set End Time (minutes)
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 10, 20, 30].map((time) => (
                        <Button
                          key={time}
                          variant="outline"
                          size="sm"
                          onClick={() => handleTimeSelection(time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                    <div className="flex space-x-2 items-center">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Custom"
                        value={customTime}
                        onBlur={handleCustomTimeSet}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCustomTimeSet()
                        }
                        onChange={handleCustomTimeChange}
                        className="w-20"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTimeSelection(null)}
                      >
                        <Infinity className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-4 flex-1 justify-center">
        <Button className="bg-primary gap-2" onClick={handleClick}>
          {isConnected ? (
            <>
              Disconnect
              <CircleX size={17} />
            </>
          ) : (
            <>
              Connect
              <Cable size={17} />
            </>
          )}
        </Button>
        {isConnected && (
          <div className="flex items-center space-x-2">
            {detectedBits ? (
              <Button
                variant="outline"
                className=" w-36 gap-2 flex justify-between items-center overflow-hidden"
                onClick={() =>
                  setSelectedBits(
                    selectedBits === "auto" ? detectedBits : "auto"
                  )
                }
              >
                <span className="">Autoscale</span>
                <Switch
                  checked={selectedBits === "auto"}
                  onCheckedChange={() => {}}
                  className="mr-1 pointer-events-none"
                />
              </Button>
            ) : (
              <Select
                onValueChange={(value) =>
                  setSelectedBits(value as BitSelection)
                }
                value={selectedBits}
              >
                <SelectTrigger className="w-32 text-background bg-primary">
                  <SelectValue placeholder="Select bits" />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectItem value="ten">10 bits</SelectItem>
                  <SelectItem value="twelve">12 bits</SelectItem>
                  <SelectItem value="fourteen">14 bits</SelectItem>
                  <SelectItem value="auto">Auto Scale</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {isConnected && (
          <TooltipProvider>
            <Tooltip>
              <Button onClick={handleRecord}>
                <TooltipTrigger asChild>
                  {isRecording ? <CircleStop /> : <Circle fill="red" />}
                </TooltipTrigger>
              </Button>
              <TooltipContent>
                <p>{!isRecording ? "Start Recording" : "Stop Recording"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {recordingsCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <Button onClick={saveData}>
                <TooltipTrigger asChild>
                  {recordingsCount === 1 ? (
                    <FileDown />
                  ) : (
                    <span className="flex flex-row justify-center items-center">
                      <FileArchive />
                      <p className=" text-lg">{`(${recordingsCount})`}</p>
                    </span>
                  )}
                </TooltipTrigger>
              </Button>
              <TooltipContent>
                <p>{recordingsCount === 1 ? "Save As CSV" : "Save As Zip"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex-1"></div>
    </div>
  );
};

export default Connection;
