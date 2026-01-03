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
import { Lock, User, KeyRound, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { loginAction } from "@/actions/auth";

export function LoginModal() {
  const { source, target, setSource, setTarget, setSourceConnected, setTargetConnected } = useAppStore();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ source?: 'success'|'error', target?: 'success'|'error', msg?: string }>({});

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setStatus({});
    
    const credentials = { username, password };
    
    // Parallel Login
    const loginPromise = async (
        type: 'source' | 'target', 
        config: typeof source, 
        setter: typeof setSource,
        connector: typeof setSourceConnected
    ) => {
        try {
            if (!config.apiBase) throw new Error("API Base URL missing");
            const data = await loginAction(credentials, config);
            setter({ ...config, token: data.accessToken });
            connector(true); // Assume successful login means connected
            return { type, success: true };
        } catch (err) {
            console.error(`Login failed for ${type}`, err);
            return { type, success: false, msg: err instanceof Error ? err.message : 'Failed' };
        }
    };

    const results = await Promise.all([
        loginPromise('source', source, setSource, setSourceConnected),
        loginPromise('target', target, setTarget, setTargetConnected)
    ]);

    const newStatus: typeof status = {};
    if (results[0].success) newStatus.source = 'success';
    else newStatus.source = 'error';
    
    if (results[1].success) newStatus.target = 'success';
    else newStatus.target = 'error';

    // 如果至少有一个失败，保留错误信息
    const errorMsg = results.find(r => !r.success)?.msg;
    if (errorMsg) newStatus.msg = errorMsg;

    setStatus(newStatus);
    setLoading(false);

    // 如果全成功，延迟关闭
    if (results[0].success && results[1].success) {
        setTimeout(() => setOpen(false), 1000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
          <KeyRound className="w-4 h-4" />
          双环境一键登录
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle>一键获取 Token</DialogTitle>
          <DialogDescription className="text-slate-400">
            仅需输入一次账号密码，系统将自动尝试登录 Source 和 Target 环境并填入 Token。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="username">账号</Label>
            <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-700"
                />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-700"
                />
            </div>
          </div>

          {/* Status Indicators */}
          {(status.source || status.target) && (
             <div className="grid grid-cols-2 gap-4 mt-2">
                 <div className={`p-2 rounded border text-xs flex items-center justify-between ${status.source === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <span>来源环境</span>
                    {status.source === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                 </div>
                 <div className={`p-2 rounded border text-xs flex items-center justify-between ${status.target === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <span>目标环境</span>
                    {status.target === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                 </div>
             </div>
          )}
          {status.msg && <p className="text-xs text-red-400 text-center">{status.msg}</p>}

        </div>
        <DialogFooter>
          <Button onClick={handleLogin} disabled={loading || !username || !password} className="w-full bg-blue-600 hover:bg-blue-500">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? '正在登录双端...' : '立即登录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
