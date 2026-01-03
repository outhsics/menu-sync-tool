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
          case 'pending': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
          case 'success': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
          case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
          default: return <Server className="w-4 h-4 text-slate-500" />;
      }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
          <KeyRound className="w-4 h-4" />
          双环境登录
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] bg-slate-900 border-slate-700 text-slate-100 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>环境登录 (需滑块验证)</DialogTitle>
          <DialogDescription className="text-slate-400">
            请依次为 Source 和 Target 环境登录。点击下方标签切换环境。
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
            <button
                onClick={() => setActiveTab('source')}
                className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                    activeTab === 'source' ? "border-b-2 border-blue-500 text-blue-400 bg-slate-800/50" : "text-slate-400 hover:text-slate-200"
                )}
            >
                {getStatusIcon(sourceStatus)}
                来源环境 (Source)
            </button>
            <button
                onClick={() => setActiveTab('target')}
                className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                    activeTab === 'target' ? "border-b-2 border-blue-500 text-blue-400 bg-slate-800/50" : "text-slate-400 hover:text-slate-200"
                )}
            >
                {getStatusIcon(targetStatus)}
                目标环境 (Target)
            </button>
        </div>

        {/* Form */}
        <div className="p-6 pt-4 space-y-4">
            <div className="text-xs text-slate-500 font-mono truncate bg-slate-800 p-2 rounded">
                API: {currentConfig.apiBase || '未配置'}
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tenant" className="text-xs">租户名称</Label>
                <div className="relative">
                    <Server className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      id="tenant"
                      placeholder="请输入租户名称"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 h-9 text-sm"
                    />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="username" className="text-xs">账号</Label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      id="username"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 h-9 text-sm"
                    />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs">密码</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 h-9 text-sm"
                    />
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{errorMsg}</p>}
            
            {currentStatus === 'success' && (
                <p className="text-xs text-green-400 bg-green-500/10 p-2 rounded flex items-center gap-2">
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
                  "w-full",
                  currentStatus === 'success' ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"
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
