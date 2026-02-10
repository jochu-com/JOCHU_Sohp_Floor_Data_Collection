import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Loader2 } from 'lucide-react';

const SignUp = () => {
    const { register, handleSubmit, formState: { errors }, setError } = useForm();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const onSubmit = async (data) => {
        setLoading(true);
        setMessage(null);
        try {
            // Basic validation handled by react-hook-form, but custom logic for password 'alphanumeric' if needed
            // Prompt: "用戶密碼是必填欄位，且必須包含英數字至少4位" -> Regex for simplicity or just length.
            // Let's rely on pattern.

            const response = await registerUser(data.username, data.password, data.email);

            if (response.status === 'success') {
                setMessage({ type: 'success', text: response.message });
                setTimeout(() => navigate('/'), 2000);
            } else {
                setMessage({ type: 'error', text: response.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>用戶註冊</CardTitle>
                    <CardDescription>建立您的帳號以使用製令系統</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">用戶名稱</label>
                            <Input
                                {...register('username', { required: '用戶名稱是必填欄位' })}
                                placeholder="輸入用戶名稱"
                            />
                            {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">用戶密碼</label>
                            <Input
                                type="password"
                                {...register('password', {
                                    required: '密碼是必填欄位',
                                    minLength: { value: 4, message: '用戶密碼必須包含至少4位英/數字！' },
                                    pattern: { value: /^[a-zA-Z0-9]+$/, message: '用戶密碼必須包含英/數字！' }
                                })}
                                placeholder="輸入密碼 (至少4碼英數)"
                            />
                            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">電郵地址</label>
                            <Input
                                type="email"
                                {...register('email', {
                                    required: '電郵地址是必填欄位',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: '電郵地址不符合電子郵件地址規則！'
                                    }
                                })}
                                placeholder="user@example.com"
                            />
                            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
                        </div>

                        {message && (
                            <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {message.text}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '註冊'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-sm text-gray-500">
                        已經有帳號？ <Link to="/" className="text-blue-600 hover:underline">登入</Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default SignUp;
