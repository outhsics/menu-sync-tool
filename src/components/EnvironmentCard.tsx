"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Trash2 } from 'lucide-react';
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className={cn(
        "relative overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200",
        config.isConnected && "border-primary/40 ring-1 ring-primary/15"
      )}>
        {/* Status strip */}
        <div className={cn(
          "h-0.5 w-full transition-colors",
          config.isConnected ? "bg-gradient-to-r from-green-500 to-emerald-500" : "bg-muted"
        )} />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 pt-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              "shrink-0 inline-flex items-center justify-center h-6 px-2 rounded-md font-mono text-[10px] font-bold tracking-wider",
              title === '来源环境'
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
            )}>
              {title === '来源环境' ? 'SRC' : 'TGT'}
            </span>
            <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
          </div>
          {config.isConnected && (
            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 shadow-none gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              已连接
            </Badge>
          )}
        </div>

        <CardContent className="space-y-4 p-5 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">API 基础路径</Label>
            <Input
              placeholder="https://api-byjedu.com"
              value={config.apiBase}
              onChange={(e) => onUpdate({ apiBase: e.target.value, isConnected: false })}
              className="bg-background border-border focus:border-primary focus:ring-primary/20 text-foreground h-10"
              list={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}
            />
            <datalist id={title === '来源环境' ? 'api-presets-source' : 'api-presets-target'}>
              <option value="https://test-api.bangyangjia.com" />
              <option value="https://api-byjedu.com" />
              <option value="https://dev-api.bangyangjia.com" />
              <option value="http://localhost:48080" />
            </datalist>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">租户 ID</Label>
                <Input
                    value={config.tenantId}
                    onChange={(e) => onUpdate({ tenantId: e.target.value, isConnected: false })}
                    className="bg-background border-border focus:border-primary focus:ring-primary/20 text-foreground h-10"
                />
            </div>
            <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Access Token</Label>
                <Input
                    type="text"
                    placeholder="粘贴 Access Token"
                    value={config.token}
                    onChange={(e) => onUpdate({ token: e.target.value, isConnected: false })}
                    className="font-mono text-sm bg-background border-border focus:border-primary focus:ring-primary/20 text-foreground h-10"
                />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50"
              >
                <X className="w-3.5 h-3.5 shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleTestConnection}
              disabled={loading || !config.apiBase || !config.token}
              className={cn(
                "flex-1 h-10 transition-all shadow-sm cursor-pointer font-medium",
                config.isConnected
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {loading ? '连接中...' : config.isConnected ? '刷新连接' : '测试连接'}
            </Button>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onUpdate({ apiBase: '', token: '', tenantId: '1', isConnected: false })}
                className="h-10 w-10 border-border text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                aria-label="清空配置"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
