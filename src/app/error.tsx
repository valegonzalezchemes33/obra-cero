"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled client error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-destructive/30">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="inline-flex h-12 w-12 rounded-full bg-destructive/10 items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold">Algo sali&oacute; mal</h2>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
              Ocurri&oacute; un error inesperado al cargar esta secci&oacute;n. Esto puede deberse a un problema de
              conexi&oacute;n con la base de datos o a un dato inesperado.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {error.digest ? `ID: ${error.digest}` : error.message.slice(0, 80)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}