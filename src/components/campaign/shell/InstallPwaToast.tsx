'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { CAMPAIGN_PWA_INSTALL_TOAST_KEY } from '@/utilities/campaignPwa'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const TOAST_ID = 'campaign-pwa-install'

const isMobileViewport = (): boolean =>
  window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches

const isStandaloneDisplay = (): boolean => {
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return standaloneMedia || iosStandalone
}

const wasDismissedThisSession = (): boolean => {
  try {
    return sessionStorage.getItem(CAMPAIGN_PWA_INSTALL_TOAST_KEY) === '1'
  } catch {
    // sessionStorage can throw in private mode.
    return false
  }
}

const markDismissedThisSession = (): void => {
  try {
    sessionStorage.setItem(CAMPAIGN_PWA_INSTALL_TOAST_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const isIosSafari = (): boolean => {
  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIos && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

const dismissInstallToast = (): void => {
  markDismissedThisSession()
  toast.dismiss(TOAST_ID)
}

export const InstallPwaToast = () => {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [iosDrawerOpen, setIosDrawerOpen] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPromptRef.current = event as BeforeInstallPromptEvent
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    if (!isMobileViewport() || isStandaloneDisplay() || wasDismissedThisSession()) return

    const installAndroid = async () => {
      const promptEvent = deferredPromptRef.current
      if (!promptEvent) return
      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        if (choice.outcome === 'accepted') dismissInstallToast()
      } catch {
        // Native install prompt dismissed or rejected.
      }
    }

    // Wait briefly so `beforeinstallprompt` can arrive after SW registration.
    const timer = window.setTimeout(() => {
      if (isStandaloneDisplay() || wasDismissedThisSession()) return

      const hasPrompt = deferredPromptRef.current != null
      if (!hasPrompt && !isIosSafari()) return

      toast.message('Instale o app da campanha', {
        id: TOAST_ID,
        description: 'Acesse mais rápido e receba avisos',
        duration: Infinity,
        closeButton: true,
        onDismiss: markDismissedThisSession,
        action: {
          label: hasPrompt ? 'Instalar' : 'Como instalar',
          onClick: () => {
            if (hasPrompt) {
              void installAndroid()
              return
            }
            setIosDrawerOpen(true)
          },
        },
      })
    }, 1200)

    return () => {
      window.clearTimeout(timer)
      toast.dismiss(TOAST_ID)
    }
  }, [])

  return iosDrawerOpen ? (
    <Drawer open={iosDrawerOpen} onOpenChange={setIosDrawerOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Como instalar no iPhone</DrawerTitle>
          <DrawerDescription>
            No Safari, use o menu de compartilhamento para adicionar o app à Tela de Início.
          </DrawerDescription>
        </DrawerHeader>
        <ol className="list-decimal space-y-2 px-4 pb-2 text-left text-sm text-foreground">
          <li>Toque no botão Compartilhar (quadrado com seta para cima).</li>
          <li>Role e toque em &quot;Adicionar à Tela de Início&quot;.</li>
          <li>Confirme tocando em Adicionar.</li>
        </ol>
        <DrawerFooter>
          <DrawerCloseButton onClick={dismissInstallToast}>Entendi</DrawerCloseButton>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ) : null
}
