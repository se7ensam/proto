import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TypewriterTextProps {
    content: string
    isStreaming?: boolean
    speed?: number
}

export default function TypewriterText({
    content,
    isStreaming = false,
    speed = 10
}: TypewriterTextProps) {
    const [displayedContent, setDisplayedContent] = useState(() => {
        // If we're not streaming, show full content immediately to avoid re-animating history
        // If we are streaming, start empty to animate the new content
        return isStreaming ? '' : content
    })

    const isFirstRender = useRef(true)

    // Handle initialization and mode switching
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        // If we stop streaming, ensure we show everything immediately (optional, or we can let it finish typing)
        // ChatGPT usually finishes typing quickly if network finishes, but doesn't necessarily snap.
        // However, for robustness, if streaming flag is off, we might want to ensure consistency.
        // Let's rely on the typing loop to finish naturally unless it's drastically different.

        if (!isStreaming && displayedContent.length < content.length) {
            // Optional: Speed up or snap? 
            // If we assume "isStreaming" becoming false means "done", 
            // we might want to let the regular loop finish the remaining buffer.
            // So we do nothing special here, the typing loop below handles it.
        }
    }, [isStreaming, content, displayedContent])

    // Handle typing animation
    useEffect(() => {
        // Safety check: If displayed content doesn't match the start of content 
        // (e.g. content changed drastically/regenerated), or displayed is longer, snap to content.
        if (!content.startsWith(displayedContent)) {
            setDisplayedContent(content)
            return
        }

        // If we have more to type
        if (displayedContent.length < content.length) {
            const timeoutId = setTimeout(() => {
                // Take the next character from the target content
                setDisplayedContent(content.slice(0, displayedContent.length + 1))
            }, speed)

            return () => clearTimeout(timeoutId)
        }
    }, [content, displayedContent, speed])

    return (
        <span className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => <span className="mb-2 last:mb-0 block">{children}</span>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-4 italic my-2">{children}</blockquote>,
                    code: ({ inline, className, children, ...props }: any) => {
                        return inline ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <div className="bg-muted/50 p-3 rounded-md my-2 overflow-x-auto">
                                <code className="text-xs font-mono block" {...props}>
                                    {children}
                                </code>
                            </div>
                        )
                    },
                    pre: ({ children }) => <pre className="m-0 p-0 bg-transparent">{children}</pre>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{children}</a>,
                }}
            >
                {displayedContent}
            </ReactMarkdown>
        </span>
    )
}
