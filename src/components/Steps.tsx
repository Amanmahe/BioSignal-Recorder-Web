import React, { useState, useRef, useCallback, useEffect } from "react";

import { Card, CardContent } from "./ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import Link from "next/link";
import { Badge } from "./ui/badge";
import Image from "next/image";

const Steps: React.FC = () => {
  const ImageLinks = [
    "https://docs.upsidedownlabs.tech/_images/connections-with-arduino.png",
    "https://docs.upsidedownlabs.tech/_images/connection-with-cable.png",
    "https://docs.upsidedownlabs.tech/_images/emg.png",
    "https://docs.upsidedownlabs.tech/_images/ecg.png",
    "https://docs.upsidedownlabs.tech/_images/eog-horizontal.png",
    "https://docs.upsidedownlabs.tech/_images/eog-vertical.png",
  ];

  const carouselItems = [
    {
      title: "BioAmp hardware to MCU/ADC Connection",
      content: (
        <>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>BioAmp</TableHead>
                <TableHead className="text-right">MCU/ADC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">VCC</TableCell>
                <TableCell className="text-right">5V</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GND</TableCell>
                <TableCell className="text-right">GND</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">OUT</TableCell>
                <TableCell className="text-right">ADC Input</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-red-500 mt-4 text-sm font-semibold">
            Warning: If power pins are swapped, your BioAmp hardware will be
            fried and become unusable (DIE).
          </p>
        </>
      ),
    },
    {
      title: "Connection with Arduino",
      image: ImageLinks[0],
    },
    {
      title: "BioAmp Cable Connections",
      content: (
        <div className="flex flex-col items-center">
          <ol className="list-decimal pl-4 text-sm sm:text-base mb-4 mt-4">
            <li>
              Connect the BioAmp cable to BioAmp hardware by inserting the cable
              end in the JST PH connector.
            </li>
            <li>Connect the BioAmp cable to gel electrodes.</li>
            <li>Peel the plastic backing from electrodes.</li>
          </ol>
          <Image
            alt="Cable connection"
            width={320}
            height={320}
            src={ImageLinks[1]}
            className="rounded-xl object-contain max-h-[200px] w-full" // Ensure the image is responsive
          />
        </div>
      ),
    },
    {
      title: "Electrodes placement for EMG",
      image: ImageLinks[2],
    },
    {
      title: "Electrodes placement for ECG",
      image: ImageLinks[3],
    },
    {
      title: "Placement for EOG Horizontal",
      image: ImageLinks[4],
    },
    {
      title: "Placement for EOG Vertical",
      image: ImageLinks[5],
    },
  ];
  
  // Function to calculate height
  const calculateHeight = () => {
    if (window.innerHeight > 945) return 90;
    if (window.innerHeight > 585) return 88;
    if (window.innerHeight <= 483) return 100;
    return 80; // Default case
  };
  const [stepsHeightInVh, setStepsHeightInVh] = useState(calculateHeight());


  useEffect(() => {
    // Update height on window resize
    const handleResize = () => {
      setStepsHeightInVh(calculateHeight());
    };

    // Set the initial height
    setStepsHeightInVh(calculateHeight());
    
    // Add event listener for window resize
    window.addEventListener('resize', handleResize);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  return (
    <div className={`flex flex-col justify-center items-center gap-2 px-4 `}
    style={{ height: `calc(${stepsHeightInVh}vh)` }}>
      <div className="flex items-center justify-center text-sm sm:text-lg md:text-xl text-center">
        <span className="flex flex-row gap-2">
          Click Connect For Board Connection.
        </span>
      </div>
      <div className="text-sm sm:text-base text-muted-foreground text-center">
        For More Detailed Steps Please Refer{" "}
        <Link
          href="https://docs.upsidedownlabs.tech/hardware/bioamp/bioamp-exg-pill/index.html"
          className="underline underline-offset-4"
        >
          Official Documentation
        </Link>
      </div>
      <div className="relative w-full max-w-7xl">
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full select-none px-4 sm:px-6 md:px-8" // Adjusting padding for responsiveness
        >
          <CarouselContent>
            {carouselItems.map((item, index) => (
              <CarouselItem key={index} className="sm:basis-1/1 lg:basis-1/2">
                <Card className="border-primary h-full">
                  <CardContent className="flex flex-col h-[400px] p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-semibold mb-4 text-left">
                      {item.title}
                    </h3>
                    <div className="flex-grow flex flex-col items-center justify-center overflow-y-auto">
                      {item.image ? (
                        <Image
                          alt={item.title}
                          width={500}
                          height={500}
                          src={item.image}
                          className="rounded-xl h-full w-full object-contain" // Ensure image fits well
                        />
                      ) : (
                        item.content
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="border-primary border-2 left-1 absolute" />
          <CarouselNext className="border-primary border-2 right-1 absolute" />
        </Carousel>
      </div>
    </div>
  );
};

export default Steps;
