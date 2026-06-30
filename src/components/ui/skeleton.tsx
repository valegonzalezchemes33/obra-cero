"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <motion.div
      data-slot="skeleton"
      className={cn("bg-accent rounded-md", className)}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      {...(props as any)}
    />
  );
}

export { Skeleton }
