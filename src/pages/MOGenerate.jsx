import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProductInfo, createMO, createBatchMO } from '../api/mo';
import Scanner from '../components/Scanner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Loader2, Camera, Search, FileText, Plus, Trash2, List, Printer } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

const MOGenerate = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [scanning, setScanning] = useState(false);

    // Batch Mode State
    const [pendingItems, setPendingItems] = useState([]);

    // Manual Input State
    const [manualPartNo, setManualPartNo] = useState('');
    const [manualOrderNo, setManualOrderNo] = useState('');
    const [manualQuantity, setManualQuantity] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Handle Scan Result (Support Multiple Items)
    // Format: Order1|Part1|Qty1|Order2|Part2|Qty2...
    const handleScan = async (decodedText) => {
        setScanning(false);
        setMessage(null);

        try {
            // Split by halfwidth '|' or fullwidth '｜'
            const parts = decodedText.split(/[|｜]/).map(s => s.trim());

            // Check if parts count is valid (should be multiple of 3)
            // But sometimes might be just Order|Part (2 parts) - Backward compatibility
            // ... (omitted)

            const newItems = [];

            if (parts.length >= 3 && parts.length % 3 === 0) {
                // ...
                // Keep existing logic
                // ...
                // This block is getting too long for replacement, better to target specifically
            }
            // ...
        } catch (e) { }
    };

    // ... (This large replacement is risky)
    // Let's try targeted replacements instead.

    setScanning(false);
    setMessage(null);

    try {
        // Split by halfwidth '|' or fullwidth '｜'
        const parts = decodedText.split(/[|｜]/).map(s => s.trim());

        // Check if parts count is valid (should be multiple of 3)
        // But sometimes might be just Order|Part (2 parts) - Backward compatibility

        const newItems = [];

        if (parts.length >= 3 && parts.length % 3 === 0) {
            // Batch format: Order|Part|Qty|Order|Part|Qty...
            for (let i = 0; i < parts.length; i += 3) {
                const orderNo = parts[i];
                const partNo = parts[i + 1];
                const qty = parseInt(parts[i + 2]);

                if (orderNo && partNo && !isNaN(qty)) {
                    const item = {
                        orderNo,
                        partNo,
                        quantity: qty,
                        productName: '查詢中...' // Placeholder
                    };
                    newItems.push(item);
                    // Trigger async info fetch?
                    fetchItemName(item, newItems.length - 1 + pendingItems.length);
                }
            }
        } else if (parts.length === 2 || (parts.length === 3 && isNaN(parseInt(parts[2])))) {
            // Backward compatibility: Order|Part
            // Or Order|Part|SomethingNotQty -> Treat as Order|Part and ignore 3rd?
            // Strict compatibility: Order|Part
            newItems.push({
                orderNo: parts[0],
                partNo: parts[1],
                quantity: '', // User needs to fill
                productName: '查詢中...'
            });
            fetchItemName(newItems[0], pendingItems.length);
        } else {
            setMessage({ type: 'error', text: `格式錯誤: ${decodedText}. 預期: 工單|料號|數量` });
            return;
        }

        if (newItems.length > 0) {
            setPendingItems(prev => [...prev, ...newItems]);
            setMessage({ type: 'success', text: `已加入 ${newItems.length} 筆資料` });
        }

    } catch (e) {
        setMessage({ type: 'error', text: `解析錯誤: ${e.message}` });
    }
};

const fetchItemName = async (item, index) => {
    try {
        const res = await getProductInfo(item.partNo);
        if (res.status === 'success') {
            setPendingItems(prev => {
                const newList = [...prev];
                // Check if item still exists at this index (user might have deleted)
                // Simple check: check if partNo matches
                if (newList[index] && newList[index].partNo === item.partNo) {
                    newList[index] = { ...newList[index], productName: res.data.name };
                }
                return newList;
            });
        } else {
            setPendingItems(prev => {
                const newList = [...prev];
                if (newList[index] && newList[index].partNo === item.partNo) {
                    newList[index] = { ...newList[index], productName: '(無此料號)' };
                }
                return newList;
            });
        }
    } catch (e) {
        // failed
    }
};

const handleError = (err) => {
    // console.warn(err);
};

const handleAddManual = () => {
    if (!manualPartNo || !manualQuantity) {
        setMessage({ type: 'error', text: '請輸入料號和數量' });
        return;
    }
    const newItem = {
        orderNo: manualOrderNo || 'NA',
        partNo: manualPartNo,
        quantity: parseInt(manualQuantity),
        productName: '查詢中...'
    };

    const newIndex = pendingItems.length;
    setPendingItems([...pendingItems, newItem]);
    fetchItemName(newItem, newIndex);

    // Reset manual inputs
    setManualPartNo('');
    setManualOrderNo('');
    setManualQuantity('');
};

const handleRemoveItem = (index) => {
    const newList = [...pendingItems];
    newList.splice(index, 1);
    setPendingItems(newList);
};

const handleQuantityChange = (index, val) => {
    const newList = [...pendingItems];
    newList[index].quantity = val;
    setPendingItems(newList);
};

const handleSubmitBatch = async () => {
    if (pendingItems.length === 0) return;

    // Validate
    for (const item of pendingItems) {
        if (!item.quantity || parseInt(item.quantity) <= 0) {
            setMessage({ type: 'error', text: `料號 ${item.partNo} 數量不正確` });
            return;
        }
    }

    setLoading(true);
    setMessage(null);

    try {
        const res = await createBatchMO(pendingItems, user.email, user.username);
        if (res.status === 'success') {
            setMessage({ type: 'success', text: res.message });
            setPendingItems([]); // Clear list
        } else {
            setMessage({ type: 'error', text: res.message });
        }
    } catch (err) {
        setMessage({ type: 'error', text: '批量建立失敗: ' + err.message });
    } finally {
        setLoading(false);
    }
};

return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">製令生成 (Batch Mode)</h1>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = '#/mo-print'}
                    className="text-gray-600"
                    title="補印製令"
                >
                    <Printer className="w-5 h-5" />
                </Button>
                <div className="text-sm text-gray-500 self-center">操作者: {user?.username}</div>
            </div>
        </div>

        {/* Message Banner */}
        {message && (
            <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} whitespace-pre-line`}>
                {message.text}
            </div>
        )}

        {/* Scanning Section */}
        {!scanning && (
            <Button
                onClick={() => { setMessage(null); setScanning(true); }}
                className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700"
            >
                <Camera className="mr-2" /> 掃描加入清單 (Scan to Add)
            </Button>
        )}

        {scanning && (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Camera className="w-5 h-5" /> 掃描中...
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Scanner onScan={handleScan} onError={handleError} />
                        <Button variant="outline" onClick={() => setScanning(false)} className="w-full">
                            取消掃描
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        {/* Pending List Section */}
        {pendingItems.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <List className="w-5 h-5" /> 待生成清單 ({pendingItems.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left bg-white rounded-md shadow-sm">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
                                <tr>
                                    <th className="px-3 py-3">工單</th>
                                    <th className="px-3 py-3">料號/品名</th>
                                    <th className="px-3 py-3 w-24">數量</th>
                                    <th className="px-3 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingItems.map((item, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium">{item.orderNo}</td>
                                        <td className="px-3 py-2">
                                            <div>{item.partNo}</div>
                                            <div className="text-xs text-gray-500">{item.productName}</div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <Input
                                                type="number"
                                                className="h-8 w-20"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Button
                        onClick={handleSubmitBatch}
                        disabled={loading}
                        className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                    >
                        {loading ? <Loader2 className="mr-2 animate-spin" /> : `確認生成 ${pendingItems.length} 筆製令`}
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* Manual Add Section (Optional fallback) */}
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center cursor-pointer">
                    手動加入單筆 (Optional)
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
                <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="工單" value={manualOrderNo} onChange={e => setManualOrderNo(e.target.value)} />
                    <Input placeholder="料號" value={manualPartNo} onChange={e => setManualPartNo(e.target.value)} />
                    <Input placeholder="數量" type="number" value={manualQuantity} onChange={e => setManualQuantity(e.target.value)} />
                </div>
                <Button onClick={handleAddManual} variant="secondary" className="w-full mt-2 h-8">
                    <Plus className="w-4 h-4 mr-1" /> 加入清單
                </Button>
            </CardContent>
        </Card>

    </div>
);
};

export default MOGenerate;
