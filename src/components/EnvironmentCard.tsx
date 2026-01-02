import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Link2 } from 'lucide-react';
import { EnvConfig } from '@/store/useAppStore';
import * as api from '@/lib/api';
import { cn } from '@/lib/utils';

interface EnvironmentCardProps {
  title: string;
  config: EnvConfig;
  onUpdate: (config: Partial<EnvConfig>) => void;
  onConnected: (status: boolean) => void;
}

export function EnvironmentCard({ title, config, onUpdate, onConnected }: EnvironmentCardProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleTestConnection = async () => {
    if (!config.apiBase || !config.token) {
      setStatus('error');
      setMessage('请填写 API 地址和 Token');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      await api.fetchAllMenus({
        apiBase: config.apiBase,
        token: config.token,
        tenantId: config.tenantId
      });
      
      setStatus('success');
      setMessage('连接成功');
      onConnected(true);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '连接失败');
      onConnected(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("border-l-4 transition-all", 
      status === 'success' ? "border-l-green-500" : 
      status === 'error' ? "border-l-red-500" : "border-l-transparent"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            {title}
            {config.isConnected && <Badge variant="default" className="bg-green-600 hover:bg-green-700">已连接</Badge>}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onUpdate({ apiBase: '', token: '', tenantId: '1', isConnected: false })}>
            清除
          </Button>
        </div>
        <CardDescription>配置 API 地址和认证 Token</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API 地址</Label>
          <Input 
            placeholder="https://api.example.com" 
            value={config.apiBase}
            onChange={(e) => onUpdate({ apiBase: e.target.value, isConnected: false })}
          />
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 space-y-2">
            <Label>租户 ID</Label>
            <Input 
              value={config.tenantId}
              onChange={(e) => onUpdate({ tenantId: e.target.value, isConnected: false })}
            />
          </div>
          <div className="col-span-3 space-y-2">
            <Label>Access Token</Label>
            <Input 
              type="password"
              placeholder="eyJhbG..." 
              value={config.token}
              onChange={(e) => onUpdate({ token: e.target.value, isConnected: false })}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            {status === 'error' && <span className="text-red-500 flex items-center gap-1"><X className="w-4 h-4" /> {message}</span>}
            {status === 'success' && <span className="text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> {message}</span>}
          </div>
          
          <Button 
            onClick={handleTestConnection} 
            disabled={loading || !config.apiBase || !config.token}
            className="w-32"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
            {loading ? '连接中' : '测试连接'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
