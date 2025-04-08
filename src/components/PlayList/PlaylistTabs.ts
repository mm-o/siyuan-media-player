import { Menu, showMessage } from "siyuan";
import type { MediaItem, PlaylistConfig } from '../../core/types';
import { handleLocalFolder, handleBilibiliFavorites, createAddTabMenu } from './PlayListMenus';

/**
 * 播放列表标签页管理类
 * 负责处理播放列表标签页相关的逻辑
 */
export class PlaylistTabs {
    // 标签页状态
    private tabs: PlaylistConfig[] = [];
    private activeTabId: string = 'default';
    private isAddingTab: boolean = false;
    private inputMode: 'normal' | 'localFolder' | 'bilibiliFavorites' = 'normal';
    
    /**
     * 构造函数
     * @param i18n 国际化对象
     * @param updateCallback 更新UI的回调函数
     */
    constructor(
        private i18n: any,
        private updateCallback: (data: {
            tabs: PlaylistConfig[], 
            activeTabId: string, 
            isAddingTab: boolean,
            inputMode: string
        }) => void,
        private configManager: any
    ) {}

    /**
     * 初始化标签页
     */
    public setTabs(tabs: PlaylistConfig[]): void {
        this.tabs = tabs;
        this.notifyUpdate();
    }

    /**
     * 获取当前活动标签
     */
    public getActiveTab(): PlaylistConfig | undefined {
        return this.tabs.find(tab => tab.id === this.activeTabId);
    }

    /**
     * 获取所有标签页
     */
    public getTabs(): PlaylistConfig[] {
        return this.tabs;
    }

    /**
     * 设置活动标签ID
     */
    public setActiveTabId(tabId: string): void {
        this.activeTabId = tabId;
        this.notifyUpdate();
    }

    /**
     * 设置标签添加状态
     */
    public setAddingState(isAdding: boolean): void {
        this.isAddingTab = isAdding;
        this.notifyUpdate();
    }

    /**
     * 设置输入模式
     */
    public setInputMode(mode: 'normal' | 'localFolder' | 'bilibiliFavorites'): void {
        this.inputMode = mode;
        this.notifyUpdate();
    }

    /**
     * 添加标签
     */
    public add(): void {
        if (!this.isAddingTab) {
            this.isAddingTab = true;
            this.inputMode = 'normal';
            this.notifyUpdate();
        }
    }

    /**
     * 处理标签保存
     */
    public save(event: KeyboardEvent | FocusEvent, tab?: PlaylistConfig): void {
        if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
        
        const input = event.target as HTMLInputElement;
        const newName = input.value.trim();
        
        try {
            if (tab) {
                // 保存已有标签
                this.tabs = this.tabs.map(t => 
                    t.id === tab.id 
                    ? { ...t, name: newName || t.name, isEditing: false }
                    : t
                );
            } else if (newName) {
                if (this.inputMode === 'normal') {
                    // 添加普通标签
                    this.tabs = [...this.tabs, {
                        id: `tab-${Date.now()}`,
                        name: newName,
                        items: []
                    }];
                } else if (this.inputMode === 'localFolder') {
                    // 处理本地文件夹路径
                    handleLocalFolder(
                        newName, 
                        this.i18n, 
                        {
                            onCreateTab: (newTab) => {
                                this.tabs = [...this.tabs, newTab];
                                this.notifyUpdate();
                            },
                            onSetActiveTab: (tabId) => {
                                this.activeTabId = tabId;
                                this.notifyUpdate();
                            },
                            onAddMedia: async (mediaPath) => {
                                // 这里应该交由外部处理，将来需要改进
                                return Promise.resolve();
                            }
                        }
                    );
                } else if (this.inputMode === 'bilibiliFavorites') {
                    // 处理B站收藏夹
                    handleBilibiliFavorites(
                        newName, 
                        this.i18n,
                        this.configManager,
                        {
                            onCreateTab: (newTab) => {
                                this.tabs = [...this.tabs, newTab];
                                this.notifyUpdate();
                            },
                            onSetActiveTab: (tabId) => {
                                this.activeTabId = tabId;
                                this.notifyUpdate();
                            },
                            onAddMedia: async (mediaPath) => {
                                // 这里应该交由外部处理，将来需要改进
                                return Promise.resolve();
                            }
                        }
                    );
                }
            }
            
            // 统一处理状态更新
            this.isAddingTab = false;
            input.value = '';
            this.notifyUpdate();
            
        } catch (error) {
            console.error('[PlaylistTabs] 保存标签失败:', error);
            showMessage(this.i18n.playList.error.saveFailed);
        }
    }

    /**
     * 显示标签右键菜单
     */
    public showContextMenu(event: MouseEvent, tab: PlaylistConfig): void {
        try {
            const menu = new Menu("tabContextMenu");
            
            // 仅对非固定标签显示编辑选项
            if (!tab.isFixed) {
                menu.addItem({
                    icon: "iconEdit",
                    label: this.i18n.playList.menu.rename,
                    click: () => this.handleRename(tab)
                });
                
                menu.addItem({
                    icon: "iconTrashcan",
                    label: this.i18n.playList.menu.delete,
                    click: () => this.handleDelete(tab)
                });
                
                menu.addSeparator();
            }
            
            menu.addItem({
                icon: "iconClear",
                label: this.i18n.playList.menu.clear,
                click: () => this.handleClear(tab)
            });
            
            menu.open({ x: event.clientX, y: event.clientY });
        } catch (error) {
            console.error('[PlaylistTabs] 显示右键菜单失败:', error);
        }
    }

    /**
     * 处理重命名
     */
    private handleRename(tab: PlaylistConfig): void {
        this.tabs = this.tabs.map(t => ({
            ...t,
            isEditing: t.id === tab.id
        }));
        this.notifyUpdate();
        
        // 延迟执行，确保DOM更新后再获取输入框
        setTimeout(() => {
            const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
            input?.focus();
            input?.select();
        }, 0);
    }

    /**
     * 处理删除
     */
    private handleDelete(tab: PlaylistConfig): void {
        this.tabs = this.tabs.filter(t => t.id !== tab.id);
        if (this.activeTabId === tab.id) {
            this.activeTabId = 'default';
        }
        this.notifyUpdate();
    }

    /**
     * 处理清空
     */
    private handleClear(tab: PlaylistConfig): void {
        this.tabs = this.tabs.map(t => 
            t.id === tab.id 
            ? { ...t, items: [] }
            : t
        );
        this.notifyUpdate();
        showMessage(this.i18n.playList.message.listCleared.replace('${name}', tab.name));
    }

    /**
     * 创建添加标签菜单
     */
    public createAddTabMenu(event: MouseEvent): void {
        createAddTabMenu(this.i18n, {
            onAddLocalFolder: () => {
                this.isAddingTab = true;
                this.inputMode = 'localFolder';
                this.notifyUpdate();
            },
            onAddAliCloud: () => {
                // TODO: 实现添加阿里云盘功能
            },
            onAddTianYiCloud: () => {
                // TODO: 实现添加天翼云盘功能
            },
            onAddQuarkCloud: () => {
                // TODO: 实现添加夸克云盘功能
            },
            onAddBilibiliFavorites: () => {
                this.isAddingTab = true;
                this.inputMode = 'bilibiliFavorites';
                this.notifyUpdate();
            }
        })(event);
    }

    /**
     * 通知更新
     */
    private notifyUpdate(): void {
        this.updateCallback({
            tabs: this.tabs,
            activeTabId: this.activeTabId,
            isAddingTab: this.isAddingTab,
            inputMode: this.inputMode
        });
    }

    /**
     * 查找标签
     */
    public findTab(tabId: string): PlaylistConfig | undefined {
        return this.tabs.find(tab => tab.id === tabId);
    }

    /**
     * 添加媒体项到标签
     */
    public addMediaItemToTab(tabId: string, item: MediaItem): void {
        const tab = this.findTab(tabId);
        if (tab) {
            tab.items = [...(tab.items || []), item];
            this.notifyUpdate();
        }
    }

    /**
     * 从标签中移除媒体项
     */
    public removeMediaItemFromTab(tabId: string, itemId: string): void {
        const tab = this.findTab(tabId);
        if (tab) {
            tab.items = tab.items.filter(item => (item as MediaItem).id !== itemId);
            this.notifyUpdate();
        }
    }

    /**
     * 切换标签中媒体项的置顶状态
     */
    public toggleItemPin(tabId: string, itemId: string): void {
        const tab = this.findTab(tabId);
        if (!tab) return;
        
        const updatedItems = tab.items.map(item => {
            const mediaItem = item as MediaItem;
            return mediaItem.id === itemId 
                ? { ...mediaItem, isPinned: !mediaItem.isPinned } 
                : mediaItem;
        }) as MediaItem[];
        
        // 重新排序：置顶项排在前面
        tab.items = [
            ...updatedItems.filter(item => item.isPinned),
            ...updatedItems.filter(item => !item.isPinned)
        ];
        
        this.notifyUpdate();
    }

    /**
     * 切换媒体项的收藏状态
     */
    public toggleItemFavorite(itemId: string, item: MediaItem): void {
        // 找到收藏夹标签和当前活动标签
        const favoritesTab = this.findTab('favorites');
        const activeTab = this.getActiveTab();
        
        if (!favoritesTab || !activeTab) return;
        
        if (!item.isFavorite) {
            // 添加到收藏夹
            favoritesTab.items = [...(favoritesTab.items || []), { ...item, isFavorite: true }] as MediaItem[];
        } else {
            // 从收藏夹移除
            favoritesTab.items = (favoritesTab.items as MediaItem[]).filter(i => i.id !== itemId);
        }
        
        // 更新当前标签中的收藏状态
        activeTab.items = (activeTab.items as MediaItem[]).map(i => 
            i.id === itemId ? { ...i, isFavorite: !i.isFavorite } : i
        );
        
        this.notifyUpdate();
    }
} 