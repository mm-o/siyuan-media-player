import {
    Plugin,
    showMessage,
    openTab,
    IModel,
    getFrontend
} from "siyuan";
import "@/styles/components.scss";

import MediaPlayerTab from "./components/MediaPlayerTab.svelte";
import { ConfigManager } from "./core/config";
import { LinkHandler } from "./core/LinkHandler";

export default class MediaPlayerPlugin extends Plugin {
    private configManager: ConfigManager;
    private linkHandler: LinkHandler;
    private mediaPlayerTab: any;
    private activeContainer: HTMLElement | null = null;
    private readonly TAB_TYPE = "custom_tab";
    private isMobile: boolean;
    
    async onload() {
        console.log("思源媒体播放器加载");
        
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        const iconMediaPlayer = `<symbol id="iconMediaPlayer" viewBox="0 0 1024 1024">
            <path d="M513.792 514.5088m-457.0112 0a457.0112 457.0112 0 1 0 914.0224 0 457.0112 457.0112 0 1 0-914.0224 0Z" fill="#8C7BFD"></path>
            <path d="M440.6272 732.16c-17.6128 0-35.2768-4.6592-51.3024-13.9264-32.1536-18.5344-51.3024-51.7632-51.3024-88.8832V399.6672c0-37.12 19.2-70.3488 51.3024-88.8832 32.1536-18.5856 70.5024-18.5344 102.656 0l198.912 114.8416c32.1536 18.5344 51.3024 51.7632 51.3024 88.8832s-19.2 70.3488-51.3024 88.8832l-198.912 114.8416c-16.0768 9.2672-33.7408 13.9264-51.3536 13.9264z m0.0512-332.6976c-0.1024 0-0.3072 0.1024-0.4096 0.2048l0.1024 229.6832c0 0.1536 0.256 0.3072 0.4096 0.3072l198.8608-114.944c0.1536-0.0512 0.1536-0.3584 0.1024-0.512l-0.1024 0.1024-198.8608-114.8416h-0.1024z" fill="#FFE37B"></path>
        </symbol>`;
        
        this.addIcons(iconMediaPlayer);

        this.configManager = new ConfigManager(this);
        await this.configManager.load();

        const topBarElement = this.addTopBar({
            icon: "iconMediaPlayer",
            title: this.i18n.name,
            position: "right",
            callback: () => {
                this.openMediaPlayerTab();
            }
        });

        this.registerHotkeys();

        // 初始化链接处理器
        this.linkHandler = new LinkHandler(
            this.configManager,
            () => this.openMediaPlayerTab()
        );
        
        // 开始监听链接点击
        this.linkHandler.startListening();
    }

    onLayoutReady() {
        console.log("思源媒体播放器布局加载完成");
    }

    onunload() {
        console.log("思源媒体播放器卸载");
        try {
            // 确保播放器被销毁
            if (this.mediaPlayerTab?.player) {
                // 先暂停播放
                if (typeof this.mediaPlayerTab.player.pause === 'function') {
                    this.mediaPlayerTab.player.pause();
                }
                
                // 完全销毁播放器
                this.mediaPlayerTab.player.destroy(true);
            }
            
            // 停止链接监听
            if (this.linkHandler) {
                this.linkHandler.stopListening();
            }
            
            // 清理引用
            this.mediaPlayerTab = null;
            this.activeContainer = null;
        } catch (error) {
            console.error("插件卸载时清理播放器失败:", error);
        }
    }

    /**
     * 注册快捷键
     */
    private registerHotkeys() {
        // 注册截图快捷键
        this.addCommand({
            langKey: "screenshot",
            langText: this.i18n.screenshot.text,
            hotkey: "",
            callback: () => {
                this.handleHotkeyAction('screenshot');
            }
        });

        // 注册时间戳快捷键
        this.addCommand({
            langKey: "timestamp",
            langText: this.i18n.timestamp.text,
            hotkey: "",
            callback: () => {
                this.handleHotkeyAction('timestamp');
            }
        });

        // 添加循环片段快捷键
        this.addCommand({
            langKey: "loopSegment",
            langText: this.i18n.loopSegment.text,
            hotkey: "",
            callback: () => {
                this.handleHotkeyAction('loopSegment');
            }
        });
    }

    /**
     * 处理快捷键动作
     */
    private async handleHotkeyAction(action: 'screenshot' | 'timestamp' | 'loopSegment') {
        if (!this.activeContainer) {
            showMessage(this.i18n.openPlayer);
            return;
        }

        // 获取控制栏组件
        const controlBar = this.activeContainer.querySelector('.control-bar');
        if (!controlBar) {
            showMessage(this.i18n.playerNotReady);
            return;
        }

        // 获取按钮标题
        const buttonTitle = {
            screenshot: this.i18n.screenshot.name,
            timestamp: this.i18n.timestamp.name,
            loopSegment: this.i18n.loopSegment.name
        }[action];

        // 找到对应的按钮并触发点击事件
        const button = controlBar.querySelector(`button[title="${buttonTitle}"]`);
        if (button instanceof HTMLElement) {
            button.click();
        } else {
            console.warn(`找不到标题为 "${buttonTitle}" 的按钮`);
            showMessage(this.i18n.buttonNotFound);
        }
    }

    //打开媒体播放器标签页
    private openMediaPlayerTab() {
        const self = this;
        this.addTab({
            type: this.TAB_TYPE,
            init() {
                const container = document.createElement("div");
                container.className = "media-player-container";
                
                // 保存容器引用
                self.activeContainer = container;
                
                // 创建并挂载 MediaPlayerTab 组件
                self.mediaPlayerTab = new MediaPlayerTab({
                    target: container,
                    props: {
                        app: self.app,
                        configManager: self.configManager,
                        linkHandler: self.linkHandler
                    }
                });
                
                this.element.appendChild(container);
            },
            destroy() {
                console.log("Destroying media player tab");
                try {
                    // 确保播放器实例被完全销毁
                    if (self.mediaPlayerTab?.player) {
                        // 先暂停播放
                        if (typeof self.mediaPlayerTab.player.pause === 'function') {
                            self.mediaPlayerTab.player.pause();
                        }
                        
                        // 完全销毁播放器
                        self.mediaPlayerTab.player.destroy(true);
                    }
                    
                    // 销毁组件
                    if (self.mediaPlayerTab?.$destroy) {
                        self.mediaPlayerTab.$destroy();
                    }
                } catch (error) {
                    console.error("销毁播放器失败:", error);
                }
                
                // 清理引用
                self.mediaPlayerTab = null;
                self.activeContainer = null;
            }
        });

        openTab({
            app: this.app,
            custom: {
                icon: "iconMediaPlayer",
                title: this.i18n.name,
                id: this.name + this.TAB_TYPE
            }
        });
    }
}
