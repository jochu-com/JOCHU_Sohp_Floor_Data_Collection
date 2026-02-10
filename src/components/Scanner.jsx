import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

const Scanner = ({ onScan, onError }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        // Check if scanner element exists
        if (!document.getElementById('reader')) return;

        // Initialize scanner
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
            },
      /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                onScan(decodedText);
                // Optional: clear scanner after success? 
                // scanner.clear(); 
            },
            (errorMessage) => {
                if (onError) onError(errorMessage);
            }
        );

        scannerRef.current = scanner;

        // Cleanup
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
            }
        };
    }, [onScan, onError]);

    return <div id="reader" className="w-full h-auto"></div>;
};

export default Scanner;
