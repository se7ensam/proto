import { useState, useEffect, useRef } from 'react'

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

    return <span>{displayedContent}</span>
}
