import * as React from "react";

import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TooltipProps = {
  /** Content shown inside the tooltip */
  title: React.ReactNode;
  /** The element that triggers the tooltip on hover/focus */
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
};

function Tooltip({
  title,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  className,
}: TooltipProps) {
  // Nothing to show, so render the children untouched
  if (!title) return <>{children}</>;

  // If the child is a single element, make it the trigger itself.
  // Otherwise (plain text, multiple nodes), wrap it in a span.
  const trigger = React.isValidElement(children) ? (
    <TooltipTrigger render={children} />
  ) : (
    <TooltipTrigger render={<span />}>{children}</TooltipTrigger>
  );

  return (
    <TooltipRoot>
      {trigger}
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={className}
      >
        {title}
      </TooltipContent>
    </TooltipRoot>
  );
}

export default Tooltip;
