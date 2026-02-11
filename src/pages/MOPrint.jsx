import { useNavigate } from 'react-router-dom';

const MOPrint = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [orderNo, setOrderNo] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSearchAndDownload = async () => {
        // ...
    }; // We need to keep the function body or just target the top part

    // Since I can't easily replace just the top without duplicating logic if I don't read it carefully,
    // I will just replace the import and the component start.

    import { Input } from '../components/ui/Input';
    import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
    import { Loader2, Printer, Search, Download } from 'lucide-react';

    const MOPrint = () => {
        const { user } = useAuth();
        const [orderNo, setOrderNo] = useState('');
        const [loading, setLoading] = useState(false);
        const [message, setMessage] = useState(null);

        const handleSearchAndDownload = async () => {
            if (!orderNo.trim()) {
                setMessage({ type: 'error', text: '請輸入工單單號' });
                return;
            }

            setLoading(true);
            setMessage(null);

            try {
                const res = await printMOByOrder(orderNo.trim());

                if (res.status === 'success') {
                    setMessage({ type: 'success', text: res.message });

                    // Trigger Download
                    if (res.pdfBase64) {
                        const byteCharacters = atob(res.pdfBase64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'application/pdf' });

                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = res.fileName || `製令_${orderNo}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }

                } else {
                    setMessage({ type: 'error', text: res.message });
                }
            } catch (err) {
                setMessage({ type: 'error', text: '查詢或下載失敗: ' + err.message });
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="max-w-xl mx-auto p-4 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => window.location.href = '#/mo-generate'}>&larr;</Button>
                        <h1 className="text-2xl font-bold">製令補印/查詢</h1>
                    </div>
                    <div className="text-sm text-gray-500">操作者: {user?.username}</div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Printer className="w-5 h-5" /> 輸入工單號碼
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="例如: 20231012-001"
                                value={orderNo}
                                onChange={(e) => setOrderNo(e.target.value)}
                                className="flex-1"
                            />
                        </div>

                        <Button
                            onClick={handleSearchAndDownload}
                            disabled={loading}
                            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? <Loader2 className="mr-2 animate-spin" /> :
                                <><Search className="mr-2 w-5 h-5" /> 搜尋並下載 PDF</>
                            }
                        </Button>
                    </CardContent>
                </Card>

                {/* Message Banner */}
                {message && (
                    <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} whitespace-pre-line`}>
                        {message.type === 'success' && <Download className="inline-block w-5 h-5 mr-2" />}
                        {message.text}
                    </div>
                )}
            </div>
        );
    };

    export default MOPrint;
