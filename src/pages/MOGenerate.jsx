import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProductInfo, createMO } from '../api/mo';
import Scanner from '../components/Scanner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Loader2, Camera, Search, FileText } from 'lucide-react';

const MOGenerate = () => {
    const { user } = useAuth();
    const [scanning, setScanning] = useState(false);
    const [partNo, setPartNo] = useState('');
    const [orderNo, setOrderNo] = useState('');
    const [productInfo, setProductInfo] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Handle Scan Result
    const handleScan = (decodedText) => {
        setScanning(false);
        // Format: OrderNo|PartNo|Quantity
        // Use regex for both halfwidth '|' and fullwidth '｜'
        const parts = decodedText.split(/[|｜]/).map(s => s.trim());

        if (parts.length >= 2) {
            setOrderNo(parts[0]);
            setPartNo(parts[1]);
            fetchProductInfo(parts[1]);

            // If quantity is present (3rd part)
            if (parts.length >= 3) {
                const qty = parseInt(parts[2]);
                if (!isNaN(qty)) {
                    setQuantity(qty.toString());
                }
            }
        } else {
            setMessage({ type: 'error', text: `格式錯誤: ${decodedText}. 預期: 工單編號|料號|數量` });
        }
    };

    const handleError = (err) => {
        // console.warn(err); // excessive logs
    };

    const fetchProductInfo = async (pid) => {
        if (!pid) return;
        setLoading(true);
        setProductInfo(null);
        setMessage(null);
        try {
            const res = await getProductInfo(pid);
            if (res.status === 'success') {
                setProductInfo(res.data);
            } else {
                setMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '查詢失敗: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleManualSearch = () => {
        if (!partNo) {
            setMessage({ type: 'error', text: '請輸入料號' });
            return;
        }
        fetchProductInfo(partNo);
    };

    const handleSubmit = async () => {
        // Validation
        if (!productInfo) {
            setMessage({ type: 'error', text: '請先查詢料號資料' });
            return;
        }
        if (!quantity || parseInt(quantity) <= 0) {
            setMessage({ type: 'error', text: '生產數量必須大於 0' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const moData = {
                partNo: productInfo.partNo, // ensure we use the one from DB validation
                orderNo: orderNo || 'NA', // Manual input might not have orderNo, allow NA? Prompt says required? 
                // Prompt says "讓使用者刷QRCode與輸入生產數量".
                // If manual input, user might need to input OrderNo too.
                // Let's add OrderNo input in UI.
                quantity: parseInt(quantity),
                username: user.username,
                email: user.email
            };

            const res = await createMO(moData);

            if (res.status === 'success') {
                setMessage({ type: 'success', text: res.message });
                // Reset form after success?
                setProductInfo(null);
                setPartNo('');
                setOrderNo('');
                setQuantity('');
            } else {
                setMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '建立失敗: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">製令生成 (MO Generate)</h1>
                <div className="text-sm text-gray-500">操作者: {user?.username}</div>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            {/* Scanning Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Camera className="w-5 h-5" /> 掃描 / 輸入
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {scanning ? (
                        <div className="space-y-4">
                            <Scanner onScan={handleScan} onError={handleError} />
                            <Button variant="outline" onClick={() => setScanning(false)} className="w-full">
                                取消掃描
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Button
                                onClick={() => { setMessage(null); setScanning(true); }}
                                className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Camera className="mr-2" /> 啟動相機掃描
                            </Button>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-gray-300"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400">或手動輸入</span>
                                <div className="flex-grow border-t border-gray-300"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">工單編號</label>
                                    <Input
                                        value={orderNo}
                                        onChange={(e) => setOrderNo(e.target.value)}
                                        placeholder="輸入工單編號"
                                    />
                                </div>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-grow">
                                        <label className="text-sm font-medium">料號</label>
                                        <Input
                                            value={partNo}
                                            onChange={(e) => setPartNo(e.target.value)}
                                            placeholder="輸入料號"
                                        />
                                    </div>
                                    <Button onClick={handleManualSearch} disabled={loading} variant="outline">
                                        <Search className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Product Info & MO Form */}
            {productInfo && (
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5" /> 製令詳情
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="block text-gray-500">品名</span>
                                <span className="font-medium">{productInfo.name}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500">客戶圖號</span>
                                <span className="font-medium">{productInfo.customerPartNo}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500">材質</span>
                                <span className="font-medium">{productInfo.material}</span>
                            </div>
                            <div>
                                <span className="block text-gray-500">機種</span>
                                <span className="font-medium">{productInfo.model}</span>
                            </div>
                        </div>

                        {/* Stations List */}
                        <div className="border rounded-md bg-white p-3">
                            <h4 className="font-medium mb-2 text-gray-700">工站流程:</h4>
                            <div className="flex flex-wrap gap-2">
                                {productInfo.stations && productInfo.stations.map((st, idx) => (
                                    <span key={idx} className="bg-gray-100 px-2 py-1 rounded text-xs border">
                                        {idx + 1}. {st.name} ({st.time}s)
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Quantity Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1">生產數量 (必填)</label>
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="輸入生產數量"
                                className="text-lg"
                            />
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                        >
                            {loading ? <Loader2 className="mr-2 animate-spin" /> : '確認生成製令並發送 Email'}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default MOGenerate;
