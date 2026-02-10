import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const Scanner = ({ onScan, onError }) => {
    const scannerRef = useRef(null);
    const [startError, setStartError] = useState(null);

    useEffect(() => {
        // ID of the element to render the QR code scanner to.
        const headerId = "reader";

        // Prepare config
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        // Create instance
        const html5QrCode = new Html5Qrcode(headerId);
        scannerRef.current = html5QrCode;

        // Start scanning with back camera
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText, decodedResult) => {
                onScan(decodedText);
            },
            (errorMessage) => {
                // Parse error, ignore common "not found" errors to reduce noise
                // if (onError) onError(errorMessage);
            }
        ).catch(err => {
            console.error("Error starting scanner", err);
            setStartError("無法啟動相機: " + (err.message || err));
            if (onError) onError(err);
        });

        // Cleanup
        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                }).catch(err => {
                    console.error("Failed to stop scanner", err);
                });
            } else {
                html5QrCode.clear();
            }
        };
    }, []); // Run once on mount

    return (
        <div className="w-full relative">
            <div id="reader" className="w-full h-64 bg-black rounded-lg overflow-hidden"></div>
            {startError && (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-900 bg-opacity-80 text-white p-4 text-center">
                    <div>
                        <p className="text-red-400 mb-2">相機啟動失敗</p>
                        <p className="text-sm">{startError}</p>
                        <p className="text-xs mt-2 text-gray-400">請確認您已允許相機權限，且使用 HTTPS 連線。</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scanner;
