import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
    className?: string
    backdropClassName?: string
    modalId?: string
}

export function Modal({ 
    isOpen, 
    onClose, 
    children, 
    className = "",
    backdropClassName = "fixed inset-0 z-[110] flex items-center justify-center p-6 bg-bg-darker/80 backdrop-blur-md animate-in fade-in duration-300",
    modalId = "modal"
}: ModalProps) {
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        let isMouseDown = false;
        let mouseDownTarget: Element | null = null;

        const handleMouseDown = (event: MouseEvent) => {
            isMouseDown = true;
            mouseDownTarget = event.target as Element;
        };

        const handleMouseUp = (event: MouseEvent) => {
            const target = event.target as Element;
            const selection = window.getSelection();
            const selectedText = selection?.toString() || '';
            
            // Only close if:
            // 1. Mouse was initially pressed on the backdrop (not inside modal content)
            // 2. Mouse was released on the backdrop
            // 3. This wasn't a text selection operation
            const hasSelection = selectedText.length > 0 && !selection?.isCollapsed;
            const pressedOnBackdrop = mouseDownTarget?.getAttribute('data-modal-id') === modalId;
            const releasedOnBackdrop = target.getAttribute('data-modal-id') === modalId;
            
            if (isMouseDown && 
                pressedOnBackdrop &&
                releasedOnBackdrop &&
                !hasSelection) {
                onClose();
            }
            
            isMouseDown = false;
            mouseDownTarget = null;
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
            document.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isOpen, onClose, modalId]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            data-modal-id={modalId}
            className={backdropClassName}
        >
            {children}
        </div>,
        document.body
    );
}
