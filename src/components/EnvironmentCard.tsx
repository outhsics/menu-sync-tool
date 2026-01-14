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
        "relative overflow-hidden border border-border bg-card shadow-xl shadow-border/20 hover:shadow-2xl hover:shadow-border/30 transition-all cursor-pointer",
        config.isConnected && "border-primary ring-2 ring-primary/10"
      )}>
        {config.isConnected && (
            <div className="absolute top-0 right-0 p-2">
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shadow-none">已连接</Badge>
            </div>
        )}

        <CardHeader className="space-y-1 bg-muted/30 pb-4 border-b border-border">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-card-foreground">
            <Link2 className={cn("w-5 h-5", config.isConnected ? "text-primary" : "text-muted-foreground")} />
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">配置同步环境的 API 与凭证</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-card-foreground">API 基础路径</Label>
            <Input
              placeholder="https://api-byjedu.com"
              value={config.apiBase}
              onChange={(e) => onUpdate({ apiBase: e.target.value, isConnected: false })}
              className="bg-background border-border focus:border-primary focus:ring-primary/20 text-card-foreground"
              list={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}
            />
            <datalist id={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}>
              <option value="https://api-byjedu.com" />
              <option value="https://dev-api.bangyangjia.com" />
              <option value="https://test-api.bangyangjia.com" />
              <option value="http://localhost:48080" />
            </datalist>

          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 space-y-2">
                <Label className="text-sm font-medium text-card-foreground">租户 ID</Label>
                <Input
                    value={config.tenantId}
                    onChange={(e) => onUpdate({ tenantId: e.target.value, isConnected: false })}
                    className="bg-background border-border focus:border-primary focus:ring-primary/20 text-card-foreground"
                />
            </div>
            <div className="col-span-3 space-y-2">
                <Label className="text-sm font-medium text-card-foreground">Access Token</Label>
                <Input
                    type="text"
                    placeholder="粘贴 Access Token"
                    value={config.token}
                    onChange={(e) => onUpdate({ token: e.target.value, isConnected: false })}
                    className="font-mono text-sm bg-background border-border focus:border-primary focus:ring-primary/20 text-muted-foreground"
                />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900"
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
                "flex-1 transition-all shadow-md cursor-pointer",
                config.isConnected
                    ? "bg-green-600 hover:bg-green-500 shadow-green-200 text-white"
                    : "bg-primary hover:bg-primary/90 shadow-primary/20 text-white"
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {loading ? '连接中...' : config.isConnected ? '刷新连接' : '测试连接'}
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onUpdate({ apiBase: '', token: '', tenantId: '1', isConnected: false })}
                className="border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
