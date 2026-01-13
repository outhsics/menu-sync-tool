"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, KeyRound, Loader2, CheckCircle2, XCircle, Server } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { loginAction } from "@/actions/auth";
import { CaptchaModal } from "./CaptchaModal";
import { cn } from "@/lib/utils";

type EnvTab = 'source' | 'target';

export function LoginModal() {
  const { source, target, setSource, setTarget, setSourceConnected, setTargetConnected } = useAppStore();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EnvTab>('source');
  
  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("榜样教育");
  
  // Status
  const [loading, setLoading] = useState(false);
  const [sourceStatus, setSourceStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [targetStatus, setTargetStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Captcha
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const currentConfig = activeTab === 'source' ? source : target;
  const currentStatus = activeTab === 'source' ? sourceStatus : targetStatus;

  const handleLoginClick = () => {
    if (!username || !password) return;
    setErrorMsg('');
    setCaptchaOpen(true);
  };

  const handleCaptchaSuccess = async (verificationCode: string) => {
      setCaptchaOpen(false);
      setLoading(true);
      
      const setter = activeTab === 'source' ? setSource : setTarget;
      const connector = activeTab === 'source' ? setSourceConnected : setTargetConnected;
      const setStatus = activeTab === 'source' ? setSourceStatus : setTargetStatus;
      const config = currentConfig;
      
      setStatus('pending');

      try {
          if (!config.apiBase) throw new Error("API Base URL missing");
          const data = await loginAction(
              { username, password, tenantName, captchaVerification: verificationCode }, 
              config
          );
          setter({ ...config, token: data.accessToken });
          connector(true);
          setStatus('success');
          
          // Auto-switch to target if source succeeded
          if (activeTab === 'source') {
              setTimeout(() => setActiveTab('target'), 500);
          }
      } catch (err) {
          console.error(`[LoginModal] Login failed for ${activeTab}`, err);
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Login failed');
      } finally {
          setLoading(false);
      }
  };

  const getStatusIcon = (status: 'idle' | 'pending' | 'success' | 'error') => {
      switch (status) {
          case 'pending': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
          case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
          case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
          default: return <Server className="w-4 h-4 text-slate-400" />;
      }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200">
          <KeyRound className="w-4 h-4" />
          双环境登录
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] bg-white border-slate-200 text-slate-900 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-slate-50/50">
          <DialogTitle>环境登录 (需滑块验证)</DialogTitle>
          <DialogDescription className="text-slate-500">
            请依次为 Source 和 Target 环境登录。点击下方标签切换环境。
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/30">
            <button
                onClick={() => setActiveTab('source')}
                className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
                    activeTab === 'source' ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
            >
                {getStatusIcon(sourceStatus)}
                来源环境 (Source)
            </button>
            <button
                onClick={() => setActiveTab('target')}
                className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2",
                    activeTab === 'target' ? "border-blue-500 text-blue-600 bg-white" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
            >
                {getStatusIcon(targetStatus)}
                目标环境 (Target)
            </button>
        </div>

        {/* Form */}
        <div className="p-6 pt-4 space-y-4">
            <div className="text-xs text-slate-500 font-mono truncate bg-slate-100 p-2 rounded border border-slate-200">
                API: {currentConfig.apiBase || '未配置'}
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tenant" className="text-xs text-slate-600">租户名称</Label>
                <div className="relative">
                    <Server className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="tenant"
                      placeholder="请输入租户名称"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      className="pl-9 bg-white border-slate-200 h-9 text-sm focus:border-blue-500 focus:ring-blue-500/20"
                    />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="username" className="text-xs text-slate-600">账号</Label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="username"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9 bg-white border-slate-200 h-9 text-sm focus:border-blue-500 focus:ring-blue-500/20"
                    />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs text-slate-600">密码</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-white border-slate-200 h-9 text-sm focus:border-blue-500 focus:ring-blue-500/20"
                    />
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">{errorMsg}</p>}
            
            {currentStatus === 'success' && (
                <p className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {activeTab === 'source' ? '来源' : '目标'}环境登录成功！
                </p>
            )}
        </div>

        <DialogFooter className="p-6 pt-0">
          <Button 
              onClick={handleLoginClick} 
              disabled={loading || !username || !password || currentStatus === 'success'} 
              className={cn(
                  "w-full transition-shadow shadow-sm hover:shadow-md",
                  currentStatus === 'success' 
                    ? "bg-green-600 hover:bg-green-500 shadow-green-200" 
                    : "bg-blue-600 hover:bg-blue-500 shadow-blue-200"
              )}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {currentStatus === 'success' ? '已登录' : `登录 ${activeTab === 'source' ? '来源' : '目标'}环境`}
          </Button>
        </DialogFooter>

        {/* Captcha Modal */}
        <CaptchaModal 
            isOpen={captchaOpen} 
            onClose={() => setCaptchaOpen(false)}
            onSuccess={handleCaptchaSuccess}
            config={currentConfig}
        />
      </DialogContent>
    </Dialog>
  );
}
