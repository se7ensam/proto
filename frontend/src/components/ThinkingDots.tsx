export default function ThinkingDots() {
  return (
    <div className="flex space-x-1 items-center h-5 pl-1">
      <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></div>
    </div>
  )
}
