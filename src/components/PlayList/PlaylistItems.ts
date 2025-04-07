import { Menu, showMessage } from "siyuan";
import type { MediaItem, PlaylistConfig } from '../../core/types';
import { BilibiliParser } from '../../core/bilibili';

/**
 * 播放列表媒体项管理类
 * 负责处理媒体项的展示、播放、管理等逻辑
 */
export class PlaylistItems {
    // 状态
    private currentItem: MediaItem | null = null;
    private videoParts: Map<string, any[]> = new Map(); // 使用Map替代对象，提高性能
    private expandedItems: Set<string> = new Set();
    private lastClickedItem: string | null = null;
    private lastClickTime: number = 0;
    private loadingParts: Set<string> = new Set(); // 记录正在加载分P的视频ID
    
    /**
     * 构造函数
     * @param i18n 国际化对象
     * @param getTabs 获取标签页的回调函数
     * @param getActiveTabId 获取当前活动标签ID的回调函数
     * @param findTab 查找标签的回调函数
     * @param updateTabs 更新标签页的回调函数
     * @param handleMediaPlay 媒体播放处理函数
     */
    constructor(
        private i18n: any,
        private getTabs: () => PlaylistConfig[],
        private getActiveTabId: () => string,
        private findTab: (tabId: string) => PlaylistConfig | undefined,
        private updateTabs: (tabs: PlaylistConfig[]) => void,
        private handleMediaPlay: (item: MediaItem) => Promise<void>
    ) {}

    /**
     * 设置当前播放项
     */
    public setCurrentItem(item: MediaItem | null): void {
        this.currentItem = item;
    }

    /**
     * 获取当前播放项
     */
    public getCurrentItem(): MediaItem | null {
        return this.currentItem;
    }

    /**
     * 处理媒体项点击
     */
    public async handleItemClick(item: MediaItem): Promise<void> {
        const now = Date.now();
        
        // 处理B站视频分P
        if (item.type === 'bilibili' && item.bvid) {
            const needToToggle = !this.videoParts.has(item.id) || this.videoParts.get(item.id)?.length > 1;
            
            if (needToToggle) {
                // 防止重复加载
                if (!this.videoParts.has(item.id) && !this.loadingParts.has(item.id)) {
                    this.loadingParts.add(item.id);
                    try {
                        const parts = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
                        this.videoParts.set(item.id, parts);
                    } catch (error) {
                        console.error("获取视频分P列表失败", error);
                    } finally {
                        this.loadingParts.delete(item.id);
                    }
                }
                
                // 多个分P时切换展开/折叠
                if (this.videoParts.get(item.id)?.length > 1) {
                    this.expandedItems.has(item.id) 
                        ? this.expandedItems.delete(item.id) 
                        : this.expandedItems.add(item.id);
                    return;
                }
            }
        }
        
        // 双击播放逻辑
        if (this.lastClickedItem === item.id && now - this.lastClickTime < 300) {
            await this.handleMediaPlay(item);
            this.currentItem = item;
            this.expandedItems.clear();
            this.lastClickedItem = null;
            this.lastClickTime = 0;
        } else {
            this.lastClickedItem = item.id;
            this.lastClickTime = now;
        }
    }

    /**
     * 播放指定分P
     */
    public async playVideoPart(item: MediaItem, partInfo: any): Promise<void> {
        if (!item.bvid) return;
        
        try {
            const partId = `${item.id}-p${partInfo.page}`;
            const partTitle = `${item.title.split(' - P')[0]} - P${partInfo.page}${partInfo.part ? ': ' + partInfo.part : ''}`;
            const partItem = {
                ...item,
                id: partId,
                title: partTitle,
                cid: String(partInfo.cid)
            };
            
            await this.handleMediaPlay(partItem);
            this.currentItem = partItem;
        } catch (error) {
            console.error("播放分P失败", error);
            showMessage(this.i18n.playList.error.playPartFailed);
        }
    }

    /**
     * 显示媒体项右键菜单
     */
    public showContextMenu(event: MouseEvent, item: MediaItem): void {
        const menu = new Menu("mediaItemMenu");
        
        menu.addItem({
            icon: "iconPlay",
            label: this.i18n.playList.menu.play,
            click: () => this.play(item)
        });
        
        menu.addItem({
            icon: "iconPin",
            label: item.isPinned ? this.i18n.playList.menu.unpin : this.i18n.playList.menu.pin,
            click: () => this.togglePin(item)
        });
        
        menu.addItem({
            icon: "iconHeart",
            label: item.isFavorite ? this.i18n.playList.menu.unfavorite : this.i18n.playList.menu.favorite,
            click: () => this.toggleFavorite(item)
        });
        
        menu.addSeparator();
        
        menu.addItem({
            icon: "iconTrashcan",
            label: this.i18n.playList.menu.delete,
            click: () => this.deleteItem(item)
        });
        
        menu.open({ x: event.clientX, y: event.clientY });
    }

    /**
     * 播放媒体项
     */
    public async play(item: MediaItem): Promise<void> {
        await this.handleMediaPlay(item);
    }

    /**
     * 切换置顶状态
     */
    public togglePin(item: MediaItem): void {
        const activeTabId = this.getActiveTabId();
        const tab = this.findTab(activeTabId);
        if (!tab) return;
        
        const updatedItems = (tab.items as MediaItem[]).map(i => 
            i.id === item.id ? { ...i, isPinned: !i.isPinned } : i
        );
        
        tab.items = [
            ...updatedItems.filter(i => i.isPinned),
            ...updatedItems.filter(i => !i.isPinned)
        ];
        
        const tabs = this.getTabs();
        this.updateTabs([...tabs]);
    }

    /**
     * 切换收藏状态
     */
    public toggleFavorite(item: MediaItem): void {
        const tabs = this.getTabs();
        const favoritesTab = this.findTab('favorites');
        const activeTabId = this.getActiveTabId();
        const activeTab = this.findTab(activeTabId);
        
        if (!favoritesTab || !activeTab) return;
        
        if (!item.isFavorite) {
            // 添加到收藏夹
            favoritesTab.items = [...(favoritesTab.items || []), { ...item, isFavorite: true }] as MediaItem[];
        } else {
            // 从收藏夹移除
            favoritesTab.items = (favoritesTab.items as MediaItem[]).filter(i => i.id !== item.id);
        }
        
        // 更新当前标签中的收藏状态
        activeTab.items = (activeTab.items as MediaItem[]).map(i => 
            i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i
        );
        
        this.updateTabs([...tabs]);
    }

    /**
     * 删除媒体项
     */
    public deleteItem(item: MediaItem): void {
        const tabs = this.getTabs();
        const activeTabId = this.getActiveTabId();
        const tab = this.findTab(activeTabId);
        
        if (!tab) return;
        
        // 从当前标签页移除项目
        tab.items = (tab.items as MediaItem[]).filter(i => i.id !== item.id);
        
        // 如果是收藏项，也从收藏夹移除
        if (item.isFavorite) {
            const favoritesTab = this.findTab('favorites');
            if (favoritesTab) {
                favoritesTab.items = (favoritesTab.items as MediaItem[]).filter(i => i.id !== item.id);
            }
        }
        
        this.updateTabs([...tabs]);
    }

    /**
     * 判断媒体项是否正在播放
     */
    public isPlaying(item: MediaItem): boolean {
        return this.currentItem?.id === item.id || 
               (!!this.currentItem?.id && !!item.id && this.currentItem.id.startsWith(`${item.id}-p`));
    }

    /**
     * 判断媒体项是否展开
     */
    public isExpanded(item: MediaItem): boolean {
        return this.expandedItems.has(item.id);
    }

    /**
     * 获取媒体项的分P列表
     */
    public getVideoParts(item: MediaItem): any[] | undefined {
        return this.videoParts.get(item.id);
    }

    /**
     * 判断分P是否正在播放
     */
    public isPartPlaying(item: MediaItem, partInfo: any): boolean {
        const partId = `${item.id}-p${partInfo.page}`;
        return this.currentItem?.id === partId;
    }

    /**
     * 清理缓存
     */
    public clearCache(): void {
        this.videoParts.clear();
        this.expandedItems.clear();
        this.loadingParts.clear();
    }
} 