
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Check, X } from "lucide-react";
import { EnvConfig } from "@/types";
import { getCaptchaCode, checkCaptcha } from "@/actions/captcha";
import { aesEncrypt } from "@/utils/ase";
import { cn } from "@/lib/utils";

interface CaptchaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (verification: string) => void;
    config: EnvConfig;
}

export function CaptchaModal({ isOpen, onClose, onSuccess, config }: CaptchaModalProps) {
    const [loading, setLoading] = useState(false);
    const [captchaData, setCaptchaData] = useState<any>(null);
    const [sliderLeft, setSliderLeft] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startLeft, setStartLeft] = useState(0);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const IMG_WIDTH = 310;
    const IMG_HEIGHT = 155;
    const BAR_HEIGHT = 40;
    const BLOCK_WIDTH = 50; // Approximated

    useEffect(() => {
        if (isOpen) {
            fetchCaptcha();
        }
    }, [isOpen]);

    const fetchCaptcha = async () => {
        setLoading(true);
        setStatus('idle');
        setSliderLeft(0);
        setMessage('');
        try {
            const res = await getCaptchaCode(config, { captchaType: 'blockPuzzle' });
            if (res.repCode === '0000') {
                setCaptchaData(res.repData);
            } else {
                setMessage(res.repMsg || '获取验证码失败');
                setStatus('error');
            }
        } catch (e) {
            setMessage('网络错误');
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleStart = (clientX: number) => {
        if (status === 'success') return;
        setIsDragging(true);
        setStartX(clientX);
        setStartLeft(sliderLeft);
        setStatus('idle');
    };

    const handleMove = (clientX: number) => {
        if (!isDragging || !trackRef.current) return;
        const delta = clientX - startX;
        let newLeft = startLeft + delta;
        
        // Boundaries
        const maxLeft = IMG_WIDTH - BLOCK_WIDTH;
        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        setSliderLeft(newLeft);
    };

    const handleEnd = async () => {
        if (!isDragging) return;
        setIsDragging(false);

        if (!captchaData) return;

        // Verify
        // Calculate proportional x (if image is scaled, but here we enforce 310px width)
        // Original logic: moveLeftDistance = (moveLeftDistance * 310) / parseInt(setSize.imgWidth)
        // Since we force 310px, ratio is 1.
        
        const moveLeftDistance = sliderLeft;
        const secretKey = captchaData.secretKey;
        const token = captchaData.token;

        const pointData = { x: moveLeftDistance, y: 5.0 };
        const pointJson = secretKey 
            ? aesEncrypt(JSON.stringify(pointData), secretKey) 
            : JSON.stringify(pointData);

        try {
            const res = await checkCaptcha(config, {
                captchaType: 'blockPuzzle',
                pointJson: pointJson,
                token: token
            });

            if (res.repCode === '0000') {
                setStatus('success');
                setMessage('验证通过');
                
                const captchaVerification = secretKey
                    ? aesEncrypt(`${token}---${JSON.stringify(pointData)}`, secretKey)
                    : `${token}---${JSON.stringify(pointData)}`;
                
                setTimeout(() => {
                    onSuccess(captchaVerification);
                }, 1000);
            } else {
                setStatus('error');
                setMessage('验证失败，请重试');
                setTimeout(() => {
                    fetchCaptcha();
                }, 1000);
            }
        } catch (e) {
            setStatus('error');
            setMessage('验证出错');
            setTimeout(() => {
                 fetchCaptcha();
            }, 1000);
        }
    };

    // Mouse events
    const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
    const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => { if(isDragging) handleEnd(); };

    // Touch events
    const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border-none shadow-xl w-[350px]">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="font-medium text-slate-800">请完成安全验证</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                
                <div 
                    className="p-5 flex flex-col items-center gap-4 select-none"
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[155px] w-[310px] bg-slate-100 rounded">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            <span className="text-xs text-slate-400 mt-2">加载中...</span>
                        </div>
                    ) : captchaData ? (
                        <div className="relative w-[310px]">
                             {/* Image Panel */}
                             <div className="relative w-[310px] h-[155px] bg-slate-200 rounded overflow-hidden shadow-inner">
                                <img 
                                    src={`data:image/png;base64,${captchaData.originalImageBase64}`} 
                                    className="w-full h-full object-cover block"
                                    alt="captcha"
                                    draggable={false}
                                />
                                <div 
                                    className="absolute right-2 top-2 p-1 bg-white/80 rounded hover:bg-white cursor-pointer transition-colors"
                                    onClick={fetchCaptcha}
                                >
                                    <RefreshCw className="h-4 w-4 text-slate-600" />
                                </div>
                                
                                {/* Status Message Overlay */}
                                {(status === 'success' || status === 'error') && (
                                    <div className={cn(
                                        "absolute bottom-0 left-0 w-full py-1 text-center text-xs text-white transition-all",
                                        status === 'success' ? "bg-green-500/80" : "bg-red-500/80"
                                    )}>
                                        {message}
                                    </div>
                                )}
                             </div>

                             {/* Bar Area */}
                             <div 
                                ref={trackRef}
                                className={cn(
                                    "relative mt-4 w-[310px] h-[40px] bg-slate-100 rounded border border-slate-200 shadow-inner flex items-center justify-center text-xs text-slate-400",
                                    (status === 'error') && "border-red-300 bg-red-50",
                                    (status === 'success') && "border-green-300 bg-green-50",
                                )}
                             >
                                 {!isDragging && status === 'idle' && "向右滑动填充拼图"}

                                 {/* Progress Bar (Green trace) */}
                                 <div 
                                    className={cn(
                                        "absolute left-0 top-0 h-full rounded-l border border-r-0 transition-all",
                                        status === 'success' ? "bg-green-100 border-green-300" : 
                                        status === 'error' ? "bg-red-100 border-red-300" : "bg-sky-100 border-sky-300"
                                    )}
                                    style={{ width: sliderLeft + BLOCK_WIDTH/2 }} 
                                 />

                                 {/* Slider Handle + Jigsaw Piece */}
                                 <div 
                                    className={cn(
                                        "absolute top-0 h-[40px] w-[50px] bg-white border shadow flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-50 rounded",
                                        status === 'success' ? "border-green-500 bg-green-500 text-white" : 
                                        status === 'error' ? "border-red-500 bg-red-500 text-white" : 
                                        isDragging ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 text-slate-500"
                                    )}
                                    style={{ left: sliderLeft }}
                                    onMouseDown={onMouseDown}
                                    onTouchStart={onTouchStart}
                                 >
                                    {status === 'success' ? <Check className="h-5 w-5" /> : 
                                     status === 'error' ? <X className="h-5 w-5" /> :
                                     <span className="font-bold text-lg">→</span>}

                                    {/* The Jigsaw Piece (Moved with handle) */}
                                    <div 
                                        className="absolute w-[50px] h-[155px] pointer-events-none"
                                        style={{ top: -(155 + 16) }} // 155 height + 16px gap (4px margin + borders etc)
                                    >
                                        <img 
                                            src={`data:image/png;base64,${captchaData.jigsawImageBase64}`}
                                            className="w-full h-full block"
                                            alt="jigsaw"
                                        />
                                    </div>
                                 </div>
                             </div>
                        </div>
                    ) : (
                        <div className="text-red-500 text-sm">Failed to load captcha</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
