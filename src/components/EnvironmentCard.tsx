"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Link2, Trash2 } from 'lucide-react';
import { EnvConfig } from '@/types';
import { fetchMenusAction } from '@/actions/menu';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EnvironmentCardProps {
  title: string;
  config: EnvConfig;
  onUpdate: (config: Partial<EnvConfig>) => void;
  onConnected: (isConnected: boolean) => void;
}

export function EnvironmentCard({ title, config, onUpdate, onConnected }: EnvironmentCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestConnection = async () => {
    if (!config.apiBase || !config.token) {
      setError('请填写完整的 API 地址和 Token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchMenusAction({
        apiBase: config.apiBase,
        token: config.token,
        tenantId: config.tenantId
      });
      onConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
      onConnected(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={cn(
        "relative overflow-hidden border border-[var(--border)] bg-white shadow-sm hover:shadow-md transition-all",
        config.isConnected && "border-blue-500 ring-2 ring-blue-100"
      )}>
        {config.isConnected && (
            <div className="absolute top-0 right-0 p-2">
                <Badge className="bg-green-50 text-green-600 border-green-200">已连接</Badge>
            </div>
        )}
        
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Link2 className={cn("w-5 h-5", config.isConnected ? "text-blue-500" : "text-gray-400")} />
            {title}
          </CardTitle>
          <CardDescription>配置同步环境的 API 与凭证</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">API 基础路径</Label>
            <Input 
              placeholder="https://api-byjedu.com" 
              value={config.apiBase}
              onChange={(e) => onUpdate({ apiBase: e.target.value, isConnected: false })}
              className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
              list={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}
            />
            <datalist id={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}>
              <option value="https://api-byjedu.com" />
              <option value="https://dev-api.bangyangjia.com" />
              <option value="http://localhost:48080" />
            </datalist>

          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 space-y-2">
                <Label className="text-sm font-medium">租户 ID</Label>
                <Input 
                    value={config.tenantId}
                    onChange={(e) => onUpdate({ tenantId: e.target.value, isConnected: false })}
                    className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                />
            </div>
            <div className="col-span-3 space-y-2">
                <Label className="text-sm font-medium">Access Token</Label>
                <Input 
                    type="text"
                    placeholder="粘贴 Access Token" 
                    value={config.token}
                    onChange={(e) => onUpdate({ token: e.target.value, isConnected: false })}
                    className="font-mono text-sm bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-red-500 flex items-center gap-1.5 p-2 rounded bg-red-50 border border-red-100"
              >
                <X className="w-3.5 h-3.5" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleTestConnection} 
              disabled={loading || !config.apiBase || !config.token}
              className={cn(
                "flex-1 transition-all",
                config.isConnected ? "bg-green-500 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-500"
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {loading ? '连接中...' : config.isConnected ? '刷新连接' : '测试连接'}
            </Button>
            
            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => onUpdate({ apiBase: '', token: '', tenantId: '1', isConnected: false })}
                className="border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
