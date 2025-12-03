import * as React from "react"
import { X, Download, Trash2, Edit, Copy, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface SelectionToolbarProps<TData> {
  selectedCount: number
  selectedItems: TData[]
  onClearSelection: () => void
  onBulkAction?: (action: string, items: TData[]) => void
  bulkActions?: Array<{
    label: string
    action: string
    icon?: React.ReactNode
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  }>
  className?: string
  position?: "fixed" | "sticky" | "inline"
}

export function SelectionToolbar<TData>({
  selectedCount,
  selectedItems,
  onClearSelection,
  onBulkAction,
  bulkActions = [],
  className,
  position = "sticky",
}: SelectionToolbarProps<TData>) {
  if (selectedCount === 0) return null

  const defaultActions = [
    {
      label: "Export Selected",
      action: "export",
      icon: <Download className="h-4 w-4" />,
      variant: "outline" as const,
    },
    {
      label: "Delete Selected",
      action: "delete",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive" as const,
    },
  ]

  const actions = bulkActions.length > 0 ? bulkActions : defaultActions

  const positionClasses = {
    fixed: "fixed bottom-0 left-0 right-0 z-50 md:left-64",
    sticky: "sticky top-0 z-40",
    inline: "",
  }

  return (
    <div
      className={cn(
        "border-t bg-background p-3 shadow-sm",
        positionClasses[position],
        className
      )}
    >
      <div className={cn(
        "flex items-center justify-between",
        position === "fixed" && "container mx-auto"
      )}>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
          </div>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action) => (
            <Button
              key={action.action}
              variant={action.variant || "outline"}
              size="sm"
              onClick={() => onBulkAction?.(action.action, selectedItems)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          {actions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.slice(2).map((action) => (
                  <DropdownMenuItem
                    key={action.action}
                    onClick={() => onBulkAction?.(action.action, selectedItems)}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}

