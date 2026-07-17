"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { useTranslation } from "@/lib/i18n/I18nProvider";

import { getUserMessageForAppError, toAppError } from "@/lib/errors/AppError";
import { applyTheme, getStoredTheme, normalizeTheme, type AppTheme } from "@/lib/theme";
import { Select } from "@/components/ui/Select";
import { logout } from "@/features/auth/api";

import {
  appendChatMessage,
  appendChatMessageWithAttachment,
  createChatConversation,
  getIdentityMe,
  getIdentityProfile,
  getIdentitySettings,
  listChatConversations,
  listChatMessages,
  updateIdentityProfile,
  updateIdentitySettings,
} from "./api";

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  createdAt: string;
  attachments?: Array<{
    id: string;
    path: string;
    mimeType: string;
    sizeBytes: number;
    width?: number | null;
    height?: number | null;
    previewUrl?: string | null;
    filename?: string | null;
  }>;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type ProfileDraft = {
  birthdate: string;
  gender: "" | "female" | "male" | "other" | "prefer_not_to_say";
};

type SettingsDraft = {
  language: string;
  theme: string;
  notifications_enabled: boolean;
  time_zone: string;
  time_format: string;
  locale: string;
};

function MaterialIcon(props: { name: string; className?: string; title?: string }) {
  return (
    <span
      className={cx("material-symbols-outlined leading-none", props.className)}
      aria-hidden="true"
      title={props.title}
    >
      {props.name}
    </span>
  );
}

function useAutosizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return ref;
}

type ActiveConversationPageProps = {
  initialConversationId?: string | null;
};

export function ActiveConversationPage({ initialConversationId }: ActiveConversationPageProps) {
  const { t, language, setLanguage } = useTranslation();
  const [theme, setTheme] = useState<AppTheme>("light");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [composerText, setComposerText] = useState("");
  const textareaRef = useAutosizeTextarea(composerText);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [me, setMe] = useState<{ userId: string; username?: string; email?: string; extra?: Record<string, unknown> } | null>(null);
  const [profile, setProfile] = useState<{
    avatar_url?: string | null;
    first_name?: string | null;
    birthdate?: string | null;
    gender?: string | null;
  } | null>(null);
  const [settings, setSettings] = useState<SettingsDraft | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"profile" | "settings" | "appearance" | "notifications" | "localization">("profile");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    birthdate: "",
    gender: "",
  });
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    language: "tr",
    theme: "light",
    notifications_enabled: true,
    time_zone: "Europe/Istanbul",
    time_format: "24h",
    locale: "tr-TR",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  const router = useRouter();

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const scroll = () => {
      container.scrollTop = container.scrollHeight;
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    };
    scroll();
    // Retry after layout/async content (images, etc.)
    setTimeout(scroll, 50);
    setTimeout(scroll, 150);
  }, []);

  useEffect(() => {
    if (!me?.userId || !activeConversationId) return;

    if (!socketRef.current) {
      const url = process.env.NEXT_PUBLIC_CHAT_WS_URL || "ws://localhost:3004";
      socketRef.current = io(url, {
        path: "/ws",
        extraHeaders: {
          "x-user-id": me.userId,
        },
      });

      socketRef.current.on("ai_token", (data: { conversationId: string; token: string }) => {
        setIsAiTyping(false);
        setMessages((prev) => {
          if (data.conversationId !== activeConversationIdRef.current) return prev;
          
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "ai" && lastMsg.id.startsWith("temp-ai-")) {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + data.token,
            };
            return newMessages;
          } else {
            return [
              ...prev,
              {
                id: `temp-ai-${Date.now()}`,
                role: "ai",
                content: data.token,
                createdAt: new Date().toISOString(),
                attachments: undefined,
              },
            ];
          }
        });
        scrollToBottom();
      });

      socketRef.current.on("ai_done", (data: { conversationId: string }) => {
        if (data.conversationId !== activeConversationIdRef.current) return;
        setIsAiTyping(false);
        // The message is now completely saved in backend. We can optionally reload or just let it be.
      });

      socketRef.current.on("ai_error", (data: { conversationId: string; message: string }) => {
        if (data.conversationId !== activeConversationIdRef.current) return;
        setIsAiTyping(false);
        setMessagesError(data.message);
      });
    }

    socketRef.current.emit("join_conversation", { conversationId: activeConversationId });

  }, [me?.userId, activeConversationId, scrollToBottom]);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);
  useEffect(() => {
    if (!isMessagesLoading && messages.length > 0) {
      scrollToBottom();
    }
  }, [isMessagesLoading, messages.length, scrollToBottom]);
  useEffect(() => {
    const stored = getStoredTheme();
    if (!stored) return;
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      setIdentityLoading(true);
      setIdentityError(null);
      try {
        const identityMe = await getIdentityMe();
        const userId = identityMe.userId;
        setMe({ userId, username: identityMe.username, email: identityMe.email, extra: identityMe.extra });

        const [identityProfile, identitySettings] = await Promise.all([
          getIdentityProfile(userId),
          getIdentitySettings(userId),
        ]);

        setProfile({
          avatar_url: identityProfile.avatar_url,
          first_name: identityProfile.first_name,
          birthdate: identityProfile.birthdate,
          gender: identityProfile.gender,
        });

        const nextTheme = normalizeTheme(identitySettings.theme);
        setTheme(nextTheme);
        applyTheme(nextTheme);

        setSettings({
          language: identitySettings.language ?? "tr",
          theme: identitySettings.theme ?? "light",
          notifications_enabled: identitySettings.notifications_enabled ?? true,
          time_zone: identitySettings.time_zone ?? "Europe/Istanbul",
          time_format: identitySettings.time_format ?? "24h",
          locale: identitySettings.locale ?? "tr-TR",
        });
      } catch (error) {
        setIdentityError(getUserMessageForAppError(toAppError(error)));
      } finally {
        setIdentityLoading(false);
      }
    };

    void run();
  }, []);

  const sidebarName =
    profile?.first_name?.trim() || me?.username?.trim() || "User";
  const sidebarSubtitle = me?.email?.trim() || "—";
  const sidebarAvatarUrl = useMemo(() => {
    const fromProfile = profile?.avatar_url?.trim();
    const extra = me?.extra;
    const fromExtra =
      (extra && typeof extra === "object" && !Array.isArray(extra) && typeof extra.avatar_url === "string" && extra.avatar_url.trim()) ||
      (extra && typeof extra === "object" && !Array.isArray(extra) && typeof extra.picture === "string" && extra.picture.trim()) ||
      undefined;
    return fromProfile || fromExtra || "";
  }, [me?.extra, profile?.avatar_url]);
  const birthdateLabel = useMemo(() => {
    const raw = profile?.birthdate;
    if (!raw || typeof raw !== "string") return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getUTCFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }, [profile?.birthdate]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    if (!profile) return;
    const raw = profile.birthdate;
    const asDate = raw ? new Date(raw) : null;
    const yyyy = asDate && !Number.isNaN(asDate.getTime()) ? asDate.getUTCFullYear() : null;
    const mm = asDate && !Number.isNaN(asDate.getTime()) ? asDate.getUTCMonth() + 1 : null;
    const dd = asDate && !Number.isNaN(asDate.getTime()) ? asDate.getUTCDate() : null;
    const birthdate =
      yyyy && mm && dd ? `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : "";

    setProfileDraft({
      birthdate,
      gender:
        profile.gender === "female" ||
          profile.gender === "male" ||
          profile.gender === "other" ||
          profile.gender === "prefer_not_to_say"
          ? (profile.gender as ProfileDraft["gender"])
          : "",
    });
    if (settings) setSettingsDraft(settings);
    setSettingsError(null);
  }, [isSettingsOpen, profile, settings]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isSettingsOpen]);

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setHasInteracted(true);
    setComposerText(event.target.value);
  };

  const openUploadPicker = () => {
    setHasInteracted(true);
    uploadInputRef.current?.click();
  };

  const handleUploadInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHasInteracted(true);
      if (selectedFilePreview) {
        URL.revokeObjectURL(selectedFilePreview);
      }
      setSelectedFile(file);
      setSelectedFileName(file.name);
      setSelectedFilePreview(URL.createObjectURL(file));
      // Gönderme işlemi kullanıcı aksiyonuna bağlı, otomatik gitmesin
    }
    // clear input so same file can be selected again
    event.target.value = "";
  };

  const openSettings = (tab: "profile" | "settings" = "profile") => {
    setActiveSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = accountMenuRef.current;
      if (!container) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (container.contains(target)) return;
      setIsAccountMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      if (isMountedRef.current) {
        setLogoutError(getUserMessageForAppError(toAppError(error)));
      }
    } finally {
      if (isMountedRef.current) setIsLoggingOut(false);
    }
  };

  const saveProfileSettings = async () => {
    if (!me?.userId) return;
    setIsSaving(true);
    setSettingsError(null);
    try {
      const birthdate = profileDraft.birthdate.trim();
      const birthdateIso = birthdate ? `${birthdate}T00:00:00.000Z` : undefined;
      const next = await updateIdentityProfile(me.userId, {
        birthdate: birthdateIso,
        gender: profileDraft.gender || undefined,
      });
      setProfile({
        avatar_url: next.avatar_url,
        first_name: next.first_name,
        birthdate: next.birthdate,
        gender: next.gender,
      });
      setIsSettingsOpen(false);
    } catch (error) {
      setSettingsError(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const saveIdentitySettings = async () => {
    if (!me?.userId) return;
    setIsSaving(true);
    setSettingsError(null);
    try {
      const next = await updateIdentitySettings(me.userId, settingsDraft);
      const nextTheme = normalizeTheme(next.theme);
      setTheme(nextTheme);
      applyTheme(nextTheme);
      setSettings({
        language: next.language ?? "tr",
        theme: next.theme ?? "light",
        notifications_enabled: next.notifications_enabled ?? true,
        time_zone: next.time_zone ?? "Europe/Istanbul",
        time_format: next.time_format ?? "24h",
        locale: next.locale ?? "tr-TR",
      });
      setIsSettingsOpen(false);
    } catch (error) {
      setSettingsError(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const logoSrc = "/plus_logo.png";
  const closeSettings = () => setIsSettingsOpen(false);

  const formLabelClassName = "text-xs font-semibold text-text-secondary";
const formInputClassName =
  "h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/20";

const buildAttachmentUrl = (conversationId: string, messageId: string, attachmentId: string) => {
  const base = process.env.NEXT_PUBLIC_GATEWAY_BASE_URL?.trim() || "/api/gateway";
  const normalizedBase = base.replace(/\/+$/, "");
  const path = `/chat/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}`;
  return `${normalizedBase}${path}`;
};

  const canSave = !isSaving && !identityLoading && Boolean(me?.userId);
  const activeSaveHandler = activeSettingsTab === "profile" ? saveProfileSettings : saveIdentitySettings;

  const formatTimeLabel = (iso: string | null | undefined) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const loadConversations = useCallback(async () => {
    setIsConversationsLoading(true);
    setConversationsError(null);
    try {
      const data = await listChatConversations();
      const normalized = data.map<Conversation>((item) => ({
        id: item.id,
        title: item.title?.trim() || "New chat",
        createdAt: item.created_at,
        lastMessageAt: item.last_message_at ?? undefined,
      }));
      setConversations(normalized);
      if (!activeConversationId && normalized.length > 0) {
        const preferred = initialConversationId && normalized.find((c) => c.id === initialConversationId)
          ? initialConversationId
          : normalized[0].id;
        setActiveConversationId(preferred);
      }
    } catch (error) {
      setConversationsError(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsConversationsLoading(false);
    }
  }, [activeConversationId, initialConversationId]);

  const loadMessages = useCallback(async (conversationId: string, switching = false) => {
    setIsMessagesLoading(true);
    if (switching) setIsSwitchingConversation(true);
    setMessagesError(null);
    try {
      const data = await listChatMessages(conversationId, { take: 100 });
      const normalized = data
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map<ChatMessage>((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          createdAt: item.created_at,
          attachments: (item.message_attachments ?? []).map((att) => ({
            id: att.id,
            path: att.path,
            mimeType: att.mime_type,
            sizeBytes: typeof att.size_bytes === "string" ? Number(att.size_bytes) : att.size_bytes,
            width: att.width ?? null,
            height: att.height ?? null,
            filename: att.path.split("/").pop() ?? null,
            previewUrl: buildAttachmentUrl(item.conversation_id, item.id, att.id),
          })),
        }));
      setMessages(normalized);
    } catch (error) {
      setMessagesError(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsMessagesLoading(false);
      setIsSwitchingConversation(false);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom();
      setTimeout(scrollToBottom, 50);
    });
  }, [messages.length, scrollToBottom]);

  const createRealConversation = useCallback(async (): Promise<string | null> => {
    setConversationsError(null);
    try {
      const created = await createChatConversation({});
      const convo: Conversation = {
        id: created.id,
        title: created.title?.trim() || "New chat",
        createdAt: created.created_at,
        lastMessageAt: created.last_message_at ?? undefined,
      };
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      window.history.pushState(null, "", `/app/c/${convo.id}`);
      return convo.id;
    } catch (error) {
      setConversationsError(getUserMessageForAppError(toAppError(error)));
      return null;
    }
  }, []);

  const handleCreateConversation = useCallback(async (): Promise<string | null> => {
    setActiveConversationId("new");
    setMessages([]);
    window.history.pushState(null, "", `/app`);
    return "new";
  }, []);

  const handleSelectConversation = useCallback((conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setIsSwitchingConversation(true);
    setActiveConversationId(conversationId);
    window.history.pushState(null, "", `/app/c/${conversationId}`);
  }, [activeConversationId, router]);

  const handleUploadFile = useCallback(
    async (file: File, content?: string) => {
      setUploadError(null);
      setIsUploading(true);
      try {
        let conversationId = activeConversationId;
        if (!conversationId || conversationId === "new") {
          conversationId = await createRealConversation();
        }
        if (!conversationId) return;

        const result = await appendChatMessageWithAttachment(conversationId, {
          file,
          content: content ?? "",
          role: "user",
        });
        const allMessages = Array.isArray(result) ? result : [result];
        const normalized = allMessages.map<ChatMessage>((msg) => ({
          id: msg.id,
          role: msg.role as ChatMessage["role"],
          content: msg.content,
          createdAt: msg.created_at,
          attachments:
            msg.message_attachments?.map((att: any) => ({
              id: att.id as string,
              path: att.path as string,
              mimeType: att.mime_type as string,
              sizeBytes:
                typeof att.size_bytes === "string"
                  ? Number(att.size_bytes)
                  : (att.size_bytes as number),
              width: att.width ?? null,
              height: att.height ?? null,
              filename: (att.path as string).split("/").pop() ?? null,
              previewUrl: buildAttachmentUrl(msg.conversation_id, msg.id, att.id),
            })) ?? [],
        }));

        setMessages((prev) => [...prev, ...normalized]);

        const latest = normalized[normalized.length - 1];
        if (latest) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, lastMessageAt: latest.createdAt } : c,
            ),
          );
        }

        setComposerText("");
      } catch (error) {
        setUploadError(getUserMessageForAppError(toAppError(error)));
      } finally {
        setIsUploading(false);
        setSelectedFile(null);
        setSelectedFileName(null);
        setSelectedFilePreview(null);
      }
    },
    [activeConversationId, createRealConversation, selectedFilePreview],
  );

  const handleSendMessage = useCallback(async () => {
    const hasFile = Boolean(selectedFile);
    const hasText = Boolean(composerText.trim());
    if (!hasFile && !hasText) return;

    setIsSending(true);
    setMessagesError(null);
    try {
      let conversationId = activeConversationId;
      if (!conversationId || conversationId === "new") {
        conversationId = await createRealConversation();
      }
      if (!conversationId) return;

      if (hasFile && selectedFile) {
        await handleUploadFile(selectedFile, composerText.trim());
      } else if (hasText) {
        const userMessage = await appendChatMessage(conversationId, {
          content: composerText.trim(),
          role: "user",
        });
        setMessages((prev) => [
          ...prev,
          {
            id: userMessage.id,
            role: "user",
            content: userMessage.content,
            createdAt: userMessage.created_at,
            attachments: (userMessage.message_attachments ?? []).map((att) => ({
              id: att.id,
              path: att.path,
              mimeType: att.mime_type,
              sizeBytes: typeof att.size_bytes === "string" ? Number(att.size_bytes) : att.size_bytes,
              width: att.width ?? null,
              height: att.height ?? null,
              filename: att.path.split("/").pop() ?? null,
              previewUrl: null,
            })),
          },
        ]);
        setComposerText("");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, lastMessageAt: userMessage.created_at } : c,
          ),
        );
        setIsAiTyping(true);
        socketRef.current?.emit("user_message", { conversationId, content: composerText.trim() });
      }
    } catch (error) {
      setMessagesError(getUserMessageForAppError(toAppError(error)));
    } finally {
      setIsSending(false);
    }
  }, [activeConversationId, composerText, createRealConversation, handleUploadFile, selectedFile]);

  const handleFileDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        setHasInteracted(true);
        if (selectedFilePreview) {
          URL.revokeObjectURL(selectedFilePreview);
        }
        setSelectedFile(file);
        setSelectedFileName(file.name);
        setSelectedFilePreview(URL.createObjectURL(file));
      }
    },
    [selectedFilePreview],
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  useEffect(() => {
    if (!me?.userId) return;
    void loadConversations();
  }, [me?.userId, loadConversations]);

  useEffect(() => {
    if (!activeConversationId || activeConversationId === "new") return;
    void loadMessages(activeConversationId, true);
  }, [activeConversationId, loadMessages]);

  const latestMessageLabel = messages.length
    ? `${new Date(messages[messages.length - 1].createdAt).toLocaleDateString("tr-TR")} ${formatTimeLabel(
      messages[messages.length - 1].createdAt,
    )}`
    : null;

  return (
    <div
      className="bg-surface-dark text-foreground h-[100dvh] w-full flex overflow-hidden font-display selection:bg-primary/30 relative"
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="relative flex flex-col items-center justify-center gap-4 rounded-[32px] border-4 border-dashed border-primary/80 bg-black/55 px-14 py-12 shadow-2xl backdrop-blur-lg text-white">
            <div className="h-20 w-20 rounded-3xl bg-white/15 border border-white/30 flex items-center justify-center shadow-inner">
              <MaterialIcon name="cloud_upload" className="text-[42px]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold tracking-tight">Drag photo here</p>
              <p className="text-sm text-white/80">It will be selected when you drop it</p>
            </div>
          </div>
        </div>
      )}
      <aside
        className={cx(
          "border-r flex flex-col shrink-0 z-20 relative transition-[width] duration-300 ease-in-out",
          isSidebarCollapsed
            ? "bg-background/25 border-border-color/20"
            : "bg-background/75 border-border-color/50",
          isSidebarCollapsed ? "w-[60px]" : "w-72",
        )}
      >
        <button
          type="button"
          className={cx(
            "cursor-pointer absolute top-1/2 -right-2.5 -translate-y-1/2 z-30 h-9 w-5 rounded-full border border-border-color/45 bg-background/65 text-text-secondary hover:text-foreground shadow-sm transition-colors",
            "flex items-center justify-center",
          )}
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          title={isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
        >
          <MaterialIcon
            name={isSidebarCollapsed ? "chevron_right" : "chevron_left"}
            className="text-[18px]"
          />
        </button>

        <div
          className={cx(
            "h-16 flex items-center justify-between shrink-0",
            isSidebarCollapsed ? "px-2" : "px-5",
          )}
        >
          {/* Logo solda (sabit genişlik) */}
          <div className="w-12 flex justify-start">
            <Link
              href="/app"
              className={cx(
                "cursor-pointer flex items-center rounded-xl transition-colors",
                "w-11 h-11 justify-center hover:bg-foreground/5",
              )}
              onClick={(event) => {
                if (!isSidebarCollapsed) return;
                event.preventDefault();
                setIsSidebarCollapsed(false);
              }}
              aria-label="Go to app"
              title="App"
            >
              <div className="w-[38px] h-[32px] rounded-2xl overflow-hidden shrink-0">
                <Image
                  src={logoSrc}
                  alt="Clara AI"
                  width={38}
                  height={32}
                  priority
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Clara ortada */}
          <div className="flex-1 flex justify-center">
            {!isSidebarCollapsed && (
              <h6 className="font-semibold text-[20px] tracking-[0.08em] text-foreground">Clara</h6>
            )}
          </div>

          {/* Sidebar daralt ikonu sağda (sabit genişlik) */}
          <div className="w-12 flex justify-end">
            {!isSidebarCollapsed && (
              <button
                type="button"
                className={cx(
                  "cursor-pointer h-11 w-11 flex items-center justify-center transition-colors rounded-xl",
                  "text-text-secondary hover:text-foreground hover:bg-foreground/6 active:bg-foreground/10",
                )}
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <MaterialIcon name="dock_to_left" className="text-[20px]" />
              </button>
            )}
          </div>
        </div>

        <div className={cx("py-2 shrink-0 z-30 mb-2", isSidebarCollapsed ? "px-3" : "px-5")}>
          {isSidebarCollapsed ? (
            <button
              type="button"
              className={cx(
                "cursor-pointer w-full flex items-center rounded-xl text-text-secondary hover:text-foreground transition-colors border border-border-color/70",
                "bg-foreground/1 hover:bg-foreground/3 border-border-color/50",
                "h-11 justify-center px-0",
              )}
              title={t.app.newChat}
              onClick={() => void handleCreateConversation()}
              disabled={isConversationsLoading}
            >
              <MaterialIcon name="add" className={cx("text-text-secondary", "text-[20px]")} />
              <span className="sr-only">{t.app.newChat}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 justify-center">
              <button
                type="button"
                className={cx(
                  "cursor-pointer flex-1 max-w-[220px] flex items-center rounded-xl text-text-secondary hover:text-foreground transition-colors border border-border-color/70",
                  "bg-foreground/3 hover:bg-foreground/6",
                  "h-11 gap-3 px-3",
                )}
                title={t.app.newChat}
                onClick={() => void handleCreateConversation()}
                disabled={isConversationsLoading}
              >
                <MaterialIcon name="add" className={cx("text-text-secondary", "text-[22px]")} />
                <span className="text-sm font-medium">{t.app.newChat}</span>
              </button>
              <button
                type="button"
                className={cx(
                  "cursor-pointer h-11 w-11 flex items-center justify-center rounded-xl transition-colors border border-border-color/70",
                  "bg-foreground/3 hover:bg-foreground/6 text-text-secondary hover:text-foreground",
                )}
                title={t.app.search}
                aria-label={t.app.search}
              >
                <MaterialIcon name="search" className="text-[22px]" />
              </button>
            </div>
          )}
        </div>

        <div
          className={cx(
            "flex-1 overflow-y-auto space-y-4 py-2 app-scrollbar",
            isSidebarCollapsed ? "px-2" : "px-3",
          )}
        >
          {isSidebarCollapsed ? (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cx(
                    "cursor-pointer w-full h-11 rounded-xl border transition-colors flex items-center justify-center",
                    conversation.id === activeConversationId
                      ? "bg-foreground/4 border-border-color/45 text-foreground"
                      : "border-transparent text-text-secondary/60 hover:text-foreground hover:bg-foreground/2",
                  )}
                  title={conversation.title}
                  aria-label={conversation.title}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <MaterialIcon
                    name={conversation.id === activeConversationId ? "chat_bubble" : "chat_bubble_outline"}
                    className="text-[20px]"
                  />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-0.5">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const timeLabel = formatTimeLabel(conversation.lastMessageAt || conversation.createdAt);
                  return (
                    <button
                      type="button"
                      key={conversation.id}
                      className={cx(
                        "cursor-pointer w-full text-left group flex items-center justify-between p-2.5 rounded-xl transition-colors border border-transparent",
                        isActive
                          ? "bg-foreground/6 border-border-color"
                          : "hover:bg-foreground/4 text-text-secondary hover:text-foreground",
                      )}
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className={cx("text-[20px] truncate w-56", isActive && "text-foreground")}>
                          {conversation.title}
                        </span>
                        <span
                          className={cx(
                            "text-[10px] font-medium whitespace-nowrap",
                            isActive ? "text-primary" : "opacity-60",
                          )}
                        >
                          {timeLabel || "—"}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {!conversations.length && !isConversationsLoading && (
                  <div className="text-xs text-text-secondary px-2 py-3 text-center border border-dashed border-border-color/70 rounded-xl bg-foreground/3">
                    <p className="text-sm font-medium tracking-wide">
                      {t.app.noChats}
                    </p>
                  </div>
                )}
                {conversationsError && (
                  <div className="text-xs text-red-400 px-2 py-3">
                    {conversationsError}
                  </div>
                )}

              </div>
            </>
          )}
        </div>

        <div
          className={cx(
            "relative border-t border-border-color/80 bg-surface-dark/30 shrink-0 mt-auto",
            isSidebarCollapsed
              ? "p-3 flex items-center justify-center"
              : "p-4 flex items-center gap-3",
          )}
          ref={accountMenuRef}
        >
          {isSidebarCollapsed ? (
            <button
              type="button"
              className="cursor-pointer w-full h-12 rounded-xl border border-transparent hover:bg-foreground/4 transition-colors disabled:opacity-60 flex items-center justify-center"
              onClick={() => {
                setLogoutError(null);
                setIsAccountMenuOpen((prev) => !prev);
              }}
              disabled={identityLoading}
              title={t.app.settings.profile}
              aria-label={t.app.settings.profile}
            >
              {sidebarAvatarUrl ? (
                <div
                  className="w-10 h-10 rounded-full bg-cover bg-center border border-border-color relative shrink-0"
                  style={{ backgroundImage: `url('${sidebarAvatarUrl}')` }}
                >
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full border border-border-color bg-surface-lighter flex items-center justify-center relative shrink-0">
                  <span className="text-sm font-semibold text-foreground">
                    {sidebarName.slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="cursor-pointer flex items-center gap-3.5 min-w-0 flex-1 text-left rounded-xl p-2.5 -m-2.5 hover:bg-foreground/5 transition-colors disabled:hover:bg-transparent"
                onClick={() => {
                  setLogoutError(null);
                  setIsAccountMenuOpen((prev) => !prev);
                }}
                disabled={identityLoading}
                title="Profil"
              >
                {sidebarAvatarUrl ? (
                  <div
                    className="w-10 h-10 rounded-full bg-cover bg-center border border-border-color relative shrink-0"
                    style={{ backgroundImage: `url('${sidebarAvatarUrl}')` }}
                  >
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full border border-border-color bg-surface-lighter flex items-center justify-center relative shrink-0">
                    <span className="text-sm font-semibold text-foreground">
                      {sidebarName.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-foreground truncate">{sidebarName}</p>
                  <p className="text-xs text-text-secondary truncate">
                    {identityLoading ? "Loading..." : identityError ? "Connection error" : sidebarSubtitle}
                  </p>
                </div>
              </button>
              <button
                type="button"
                className={cx(
                  "cursor-pointer h-10 w-10 flex shrink-0 items-center justify-center rounded-xl transition-all",
                  "text-text-secondary hover:text-foreground hover:bg-foreground/5 active:bg-foreground/10",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  openSettings("profile");
                }}
                disabled={identityLoading}
                title={t.app.settings.profile}
              >
                <MaterialIcon name="settings" className="text-[22px]" />
                <span className="sr-only">{t.app.settings.profile}</span>
              </button>
            </>
          )}

          {isAccountMenuOpen && (
            <div className="absolute bottom-full left-3 mb-2 w-56 rounded-xl border border-border-color bg-surface-dark shadow-lg p-1 z-50">
              <button
                type="button"
                className="cursor-pointer w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-foreground/6 transition-colors"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  openSettings("profile");
                }}
              >
                <MaterialIcon name="settings" className="text-[18px] text-text-secondary" />
                Settings
              </button>
              <button
                type="button"
                className="cursor-pointer w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-foreground/6 transition-colors disabled:opacity-60"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <MaterialIcon name="logout" className="text-[18px] text-text-secondary" />
                {isLoggingOut ? "Logging out..." : t.common.logout}
              </button>
              {logoutError && <p className="px-3 pt-2 pb-1 text-xs text-red-500">{logoutError}</p>}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-surface-dark relative">
        <div
          className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col relative app-scrollbar"
          ref={messagesContainerRef}
        >
          {isSwitchingConversation && (
            <div className="absolute inset-0 z-10 bg-surface-dark/60 backdrop-blur-[2px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          <div className="mx-auto w-full max-w-3xl flex flex-col">
            <div className="flex items-center gap-4 w-full my-6 px-4 md:px-8">
              <div className="h-px bg-border-color flex-1" />
              <span className="text-xs text-text-secondary font-medium">
                {latestMessageLabel || "Chat"}
              </span>
              <div className="h-px bg-border-color flex-1" />
            </div>

            {messages.map((message) => {
              const isUser = message.role === "user";
              
              if (isUser) {
                return (
                  <div key={message.id} className="w-full flex justify-end group/message mb-6 px-4 md:px-8">
                    <div className="max-w-[85%] md:max-w-[80%] bg-surface-lighter border border-border-color/50 rounded-3xl rounded-tr-md px-5 py-3.5 shadow-sm relative">
                      <div className="text-foreground whitespace-pre-wrap break-words text-[16px] leading-relaxed">
                        {message.content}
                      </div>
                      {message.attachments?.length ? (
                        <div className="mt-3">
                          <div className="text-[11px] text-text-secondary mb-1">
                            {message.attachments[0]?.filename || "Image"}
                          </div>
                          <div className="overflow-hidden rounded-xl border border-border-color bg-black/20 max-w-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {message.attachments[0]?.previewUrl ? (
                              <img
                                src={message.attachments[0]?.previewUrl || ""}
                                alt={message.attachments[0]?.filename || "image"}
                                className="max-h-80 w-full object-contain bg-black"
                              />
                            ) : (
                              <div className="p-6 text-center text-xs text-text-secondary">
                                No preview
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                      <div className="absolute -left-10 top-2 opacity-0 group-hover/message:opacity-100 transition-opacity flex flex-col gap-1">
                        <button 
                          type="button"
                          onClick={() => navigator.clipboard.writeText(message.content)}
                          className="w-7 h-7 rounded-md hover:bg-foreground/5 text-text-secondary hover:text-foreground flex items-center justify-center transition-colors"
                          title="Kopyala"
                        >
                          <MaterialIcon name="content_copy" className="text-[15px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // AI Message
              return (
                <div key={message.id} className="w-full group/message mb-8 px-4 md:px-8">
                  <div className="w-full max-w-3xl pr-4 md:pr-12 relative">
                    <div className="text-foreground whitespace-pre-wrap break-words text-[16px] leading-relaxed">
                      <div className="min-w-0 prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3">
                        <p className="text-[16px] leading-relaxed">{message.content}</p>
                      </div>

                      {message.attachments?.length ? (
                        <div className="mt-4">
                          <div className="text-[11px] text-text-secondary mb-2 font-medium tracking-wide">
                            {message.attachments[0]?.filename || "Analysis Result"}
                          </div>
                          <div className="overflow-hidden rounded-2xl border border-border-color/60 bg-black/30 shadow-lg max-w-lg transition-transform hover:scale-[1.01] duration-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {message.attachments[0]?.previewUrl ? (
                              <img
                                src={message.attachments[0]?.previewUrl || ""}
                                alt={message.attachments[0]?.filename || "image"}
                                className="w-full h-auto max-h-[500px] object-contain bg-black/50"
                              />
                            ) : (
                              <div className="p-8 text-center text-sm text-text-secondary">
                                Processing image...
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                      
                      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                        <button 
                          type="button"
                          onClick={() => navigator.clipboard.writeText(message.content)}
                          className="w-7 h-7 rounded-md hover:bg-foreground/5 text-text-secondary hover:text-foreground flex items-center justify-center transition-colors -ml-1"
                          title="Kopyala"
                        >
                          <MaterialIcon name="content_copy" className="text-[15px]" />
                        </button>
                        {message.id === messages[messages.length - 1]?.id && (
                          <button 
                            type="button"
                            className="w-7 h-7 rounded-md hover:bg-foreground/5 text-text-secondary hover:text-foreground flex items-center justify-center transition-colors"
                            title="Regenerate"
                          >
                            <MaterialIcon name="refresh" className="text-[17px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!messages.length && !isMessagesLoading && (
              <div className="flex flex-col items-center justify-center pt-[10vh] pb-10 text-center animate-in fade-in duration-700 mx-auto w-full max-w-3xl px-4">
                {/* Logo */}
                <div className="w-16 h-16 rounded-2xl bg-surface-lighter border border-border-color/60 flex items-center justify-center shadow-sm mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/plus_logo.png" alt="Clara Logo" className="w-10 h-10 object-contain" />
                </div>

                {/* Başlık */}
                <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-10">
                  {t.app.emptyStateTitle}
                </h1>

                {/* Özellik Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  {[
                    { icon: "medical_information", text: t.app.emptyStatePrompts.p1 },
                    { icon: "image_search", text: t.app.emptyStatePrompts.p2 },
                    { icon: "monitor_heart", text: t.app.emptyStatePrompts.p3 },
                    { icon: "biotech", text: t.app.emptyStatePrompts.p4 }
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setComposerText(prompt.text)}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-border-color/50 bg-surface-lighter/30 hover:bg-surface-lighter hover:border-border-color transition-colors text-left group"
                    >
                      <MaterialIcon name={prompt.icon} className="text-[20px] text-text-secondary group-hover:text-foreground transition-colors shrink-0" />
                      <span className="text-[14px] font-medium text-text-secondary group-hover:text-foreground transition-colors leading-snug">
                        {prompt.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isMessagesLoading && (
              <div className="text-center text-sm text-text-secondary">{t.app.messagesLoading}</div>
            )}
            {messagesError && (
              <div className="text-center text-xs text-red-400">{messagesError}</div>
            )}
            {uploadError && (
              <div className="text-center text-xs text-red-400">{uploadError}</div>
            )}

            {isAiTyping && (
              <div className="w-full mb-8 px-4 md:px-8">
                <div className="w-full max-w-3xl pr-4 md:pr-12 relative">
                  <div className="flex items-center gap-1.5 h-6 mt-2 opacity-70">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div className="h-4" />
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 px-4 pb-10 pt-3">
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              accept="image/*,.dcm"
              multiple={false}
              onChange={handleUploadInputChange}
            />
            {selectedFileName && (
              <div className="mb-3 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-foreground flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedFilePreview ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-color bg-black/40 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedFilePreview}
                        alt={selectedFileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <MaterialIcon name="attach_file" className="text-primary text-base" />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{selectedFileName}</span>
                    {selectedFile && (
                      <span className="block text-[10px] text-text-secondary">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Send with Enter</span>
                  <button
                    type="button"
                    className="cursor-pointer h-7 w-7 rounded-full hover:bg-foreground/10 text-text-secondary hover:text-foreground flex items-center justify-center"
                    onClick={() => {
                      if (selectedFilePreview) URL.revokeObjectURL(selectedFilePreview);
                      setSelectedFile(null);
                      setSelectedFileName(null);
                      setSelectedFilePreview(null);
                    }}
                    title="Remove selected image"
                  >
                    <MaterialIcon name="close" className="text-[16px]" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-3xl border border-border-color bg-surface-lighter px-4 py-2.5 shadow-sm focus-within:shadow-md focus-within:border-border-color/80 transition-all">
              <button
                type="button"
                className="cursor-pointer h-8 w-8 text-text-secondary hover:text-foreground hover:bg-surface-dark rounded-full transition-colors flex items-center justify-center shrink-0 mb-0.5"
                title="Add file"
                onClick={openUploadPicker}
              >
                <MaterialIcon name="add" className="text-[22px]" />
                <span className="sr-only">Add attachment</span>
              </button>
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent border-none text-foreground text-[16px] leading-relaxed placeholder-text-secondary focus:ring-0 resize-none py-1.5 max-h-32 outline-none"
                placeholder={t.app.typeMessage}
                rows={1}
                value={composerText}
                onChange={handleComposerChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                <button
                  type="button"
                  className="cursor-pointer h-8 w-8 text-text-secondary hover:text-foreground hover:bg-surface-dark rounded-full transition-colors flex items-center justify-center"
                  title="Microphone"
                  aria-label="Microphone"
                >
                  <MaterialIcon name="mic" className="text-[20px]" />
                </button>
                <button
                  type="button"
                  className={cx(
                    "cursor-pointer h-8 w-8 rounded-full flex items-center justify-center transition-all",
                    composerText.trim() || selectedFile
                      ? "bg-foreground text-surface-lighter hover:opacity-90 active:scale-95"
                      : "bg-surface-dark text-text-secondary/50 cursor-default"
                  )}
                  title="Send"
                  onClick={() => void handleSendMessage()}
                  disabled={isSending || (!composerText.trim() && !selectedFile)}
                >
                  <MaterialIcon name="arrow_upward" className="text-[18px]" />
                  <span className="sr-only">Send</span>
                </button>
              </div>
            </div>
            
            <div className="text-center mt-3">
              <span className="text-[11px] text-text-secondary/70 font-light cursor-default">
                {t.app.footerText} <span className="mx-1.5 opacity-40">•</span> <span className="opacity-70 font-medium hover:opacity-100 transition-opacity">By: Remzi Taşkın</span>
              </span>
            </div>
            {messagesError && (
              <p className="text-xs text-red-400 mt-2">{messagesError}</p>
            )}
          </div>
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeSettings}
            aria-label="Close"
          />

          {/* Modal — ChatGPT style layout */}
          <div className="relative w-full max-w-3xl h-[600px] overflow-hidden rounded-3xl border border-border-color/50 bg-surface-lighter/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-200 flex">
            
            {/* Left sidebar nav */}
            <nav className="w-[260px] shrink-0 border-r border-border-color/10 py-6 flex flex-col px-4 bg-surface-dark/40">
              <button
                type="button"
                onClick={closeSettings}
                className="cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-foreground hover:bg-foreground/10 transition-colors mb-8 self-start"
              >
                <MaterialIcon name="close" className="text-[20px]" />
              </button>

              <div className="flex flex-col gap-1">
                {[
                  { id: "profile", icon: "person", label: t.app.settings.profile },
                  { id: "appearance", icon: "palette", label: t.app.settings.appearance },
                  { id: "notifications", icon: "notifications", label: t.app.settings.notifications },
                  { id: "localization", icon: "public", label: t.app.settings.localization },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSettingsTab(item.id as any)}
                    className={cx(
                      "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-left",
                      activeSettingsTab === item.id
                        ? "bg-foreground/10 text-foreground shadow-sm"
                        : "text-text-secondary hover:text-foreground hover:bg-foreground/5"
                    )}
                  >
                    <MaterialIcon name={item.icon} className="text-[20px] shrink-0" />
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

              {/* Right content */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface-lighter/60">
              {/* Dynamic Header */}
              <div className="px-10 pt-10 pb-6 border-b border-border-color/10 shrink-0">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  {activeSettingsTab === "profile" && t.app.settings.profile}
                  {activeSettingsTab === "appearance" && t.app.settings.appearance}
                  {activeSettingsTab === "notifications" && t.app.settings.notifications}
                  {activeSettingsTab === "localization" && t.app.settings.localization}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto app-scrollbar px-2">
                {(settingsError || identityError) && (
                  <div className="m-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3 shadow-sm">
                    <MaterialIcon name="error_outline" className="text-[20px] shrink-0" />
                    {settingsError || identityError}
                  </div>
                )}

                {/* PROFIL TAB */}
                {activeSettingsTab === "profile" && (
                  <div className="p-8 pb-12 space-y-8 max-w-2xl">
                    {/* Avatar row */}
                    <div className="flex items-center gap-6 pb-8 border-b border-border-color/10">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-3xl font-bold text-primary shadow-inner shrink-0">
                        {sidebarName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-foreground">{sidebarName}</div>
                        <div className="text-sm text-text-secondary mt-1">{sidebarSubtitle}</div>
                        <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-emerald-500/10 text-xs text-emerald-500 font-semibold border border-emerald-500/20">
                          <MaterialIcon name="verified" className="text-[14px]" />
                          Active Member
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-2 border-b border-border-color/10 pb-6">
                      <div>
                        <div className="text-sm font-medium text-foreground">Birthdate</div>
                        <div className="text-xs text-text-secondary mt-1">Visible on your profile</div>
                      </div>
                      <input
                        type="date"
                        value={profileDraft.birthdate}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, birthdate: e.target.value }))}
                        className="h-11 rounded-xl border border-border-color/30 bg-foreground/5 hover:bg-foreground/10 px-4 text-sm text-foreground outline-none focus:bg-surface-dark focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 py-2 border-b border-border-color/10 pb-6">
                      <div>
                        <div className="text-sm font-medium text-foreground">Gender</div>
                        <div className="text-xs text-text-secondary mt-1">Optional</div>
                      </div>
                      <Select
                        value={profileDraft.gender}
                        onChange={(next) => setProfileDraft((p) => ({ ...p, gender: next as ProfileDraft["gender"] }))}
                        options={[
                          { value: "", label: "Prefer not to say" },
                          { value: "female", label: "Female" },
                          { value: "male", label: "Male" },
                          { value: "other", label: "Other" },
                          { value: "prefer_not_to_say", label: "Prefer not to say" },
                        ]}
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {/* APPEARANCE TAB */}
                {activeSettingsTab === "appearance" && (
                  <div className="p-8 space-y-0">
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">Theme</div>
                      </div>
                      <Select
                        value={settingsDraft.theme}
                        onChange={(next) => setSettingsDraft((p) => ({ ...p, theme: next }))}
                        options={[
                          { value: "light", label: "Light" },
                          { value: "dark", label: "Dark" },
                        ]}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">Language</div>
                      </div>
                      <input
                        value={settingsDraft.language}
                        onChange={(e) => setSettingsDraft((p) => ({ ...p, language: e.target.value }))}
                        className="h-11 w-36 rounded-xl border border-border-color/30 bg-foreground/5 hover:bg-foreground/10 px-4 text-sm text-foreground outline-none focus:bg-surface-dark focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                  </div>
                )}

                {/* NOTIFICATIONS TAB */}
                {activeSettingsTab === "notifications" && (
                  <div className="p-8 space-y-0">
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">App notifications</div>
                        <div className="text-xs text-text-secondary mt-1">Get notifications for new messages and updates</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settingsDraft.notifications_enabled}
                        onClick={() => setSettingsDraft((p) => ({ ...p, notifications_enabled: !p.notifications_enabled }))}
                        disabled={isSaving}
                        className={cx(
                          "cursor-pointer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60 shadow-inner",
                          settingsDraft.notifications_enabled ? "bg-primary" : "bg-foreground/10 border border-border-color/20",
                        )}
                      >
                        <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform", settingsDraft.notifications_enabled ? "translate-x-6" : "translate-x-1")} />
                      </button>
                    </div>
                  </div>
                )}

                {/* LOCALIZATION TAB */}
                {activeSettingsTab === "localization" && (
                  <div className="p-8 space-y-0">
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">Time zone</div>
                      </div>
                      <input
                        value={settingsDraft.time_zone}
                        onChange={(e) => setSettingsDraft((p) => ({ ...p, time_zone: e.target.value }))}
                        className="h-11 w-44 rounded-xl border border-border-color/30 bg-foreground/5 hover:bg-foreground/10 px-4 text-sm text-foreground outline-none focus:bg-surface-dark focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">Time format</div>
                      </div>
                      <Select
                        value={settingsDraft.time_format}
                        onChange={(next) => setSettingsDraft((p) => ({ ...p, time_format: next }))}
                        options={[
                          { value: "24h", label: "System" },
                          { value: "12h", label: "12 hours" },
                        ]}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-6 border-b border-border-color/10">
                      <div>
                        <div className="text-sm font-medium text-foreground">Locale</div>
                      </div>
                      <input
                        value={settingsDraft.locale}
                        onChange={(e) => setSettingsDraft((p) => ({ ...p, locale: e.target.value }))}
                        className="h-11 w-36 rounded-xl border border-border-color/30 bg-foreground/5 hover:bg-foreground/10 px-4 text-sm text-foreground outline-none focus:bg-surface-dark focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border-color/10 px-10 py-6 shrink-0 bg-surface-lighter">
                <div className="flex items-center gap-2 text-xs font-medium text-text-secondary/60">
                  <MaterialIcon name="lock" className="text-[16px]" />
                  All settings are stored encrypted
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeSettings}
                    disabled={isSaving}
                    className="cursor-pointer px-6 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:text-foreground hover:bg-foreground/5 active:bg-foreground/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={activeSaveHandler}
                    disabled={!canSave}
                    className="cursor-pointer px-8 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Saving
                      </>
                    ) : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
