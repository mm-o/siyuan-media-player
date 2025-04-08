import { showMessage } from "siyuan";
import type { MediaItem } from '../../core/types';
import { MediaManager } from '../../core/media';
import { parseMediaLink } from '../../core/utils';

/**
 * 播放列表输入管理类
 * 负责处理媒体链接的输入和添加功能
 */
export class PlaylistInput {
    private i18n: any;
    
    /**
     * 构造函数
     * @param i18n 国际化对象
     * @param handleMediaPlay 媒体播放处理函数
     * @param getActiveTab 获取当前活动标签的函数
     * @param savePlaylists 保存播放列表的函数
     */
    constructor(
        i18n: any,
        private handleMediaPlay: (item: MediaItem) => Promise<void>,
        private getActiveTab: () => any | null,
        private savePlaylists: () => void
    ) {
        this.i18n = i18n;
    }

    /**
     * 处理添加媒体
     */
    async handleMediaAdd(url: string): Promise<void> {
        try {
            console.log("[PlaylistInput] " + this.i18n.playList.log.parseLink, url);
            
            // 1. 解析链接
            const { mediaUrl, startTime, endTime } = parseMediaLink(url);
            if (!mediaUrl) {
                throw new Error(this.i18n.playList.error.invalidUrl);
            }
            
            console.log("[PlaylistInput] " + this.i18n.playList.log.parseResult, { mediaUrl, startTime, endTime });
            
            // 2. 检查是否已存在
            const tab = this.getActiveTab();
            if (!tab) {
                throw new Error(this.i18n.playList.error.noActiveTab);
            }
            
            const existingItem = tab.items?.find(item => item.url === mediaUrl);
            if (existingItem) {
                console.log("[PlaylistInput] " + this.i18n.playList.log.usingExisting, existingItem);
                const updatedItem = {
                    ...existingItem,
                    startTime,
                    endTime,
                    originalUrl: url
                };
                console.log("[PlaylistInput] " + this.i18n.playList.log.updatedItem, updatedItem);
                await this.handleMediaPlay(updatedItem as MediaItem);
                return;
            }
            
            // 3. 创建新媒体项
            const mediaItem = await MediaManager.createMediaItem(mediaUrl);
            if (!mediaItem) {
                throw new Error(this.i18n.playList.error.cannotParse);
            }
            
            // 设置时间参数
            if (startTime !== undefined) mediaItem.startTime = startTime;
            if (endTime !== undefined) mediaItem.endTime = endTime;
            mediaItem.originalUrl = url;
            
            // 4. 添加到播放列表
            tab.items = [...(tab.items || []), mediaItem];
            this.savePlaylists();
            
            // 添加成功提示
            showMessage(this.i18n.playList.message.added);
            
        } catch (error) {
            console.error('[PlaylistInput] ' + this.i18n.playList.error.addMediaFailed, error);
            showMessage(error instanceof Error ? error.message : this.i18n.playList.error.addMediaFailed);
        }
    }

    /**
     * 处理媒体项添加
     */
    async handleMediaItem(mediaItem: MediaItem): Promise<void> {
        try {
            const activeTab = this.getActiveTab();
            if (!activeTab) {
                throw new Error(this.i18n.playList.error.noActiveTab);
            }
            
            const existingItem = activeTab.items?.find(item => 
                item.url === mediaItem.url || item.originalUrl === mediaItem.originalUrl
            );

            if (existingItem) {
                await this.handleMediaPlay(existingItem);
                showMessage(this.i18n.playList.message.existingItemPlay);
            } else {
                activeTab.items = [...(activeTab.items || []), mediaItem];
                this.savePlaylists();
                showMessage(this.i18n.playList.message.added);
            }
        } catch (error) {
            console.error('[PlaylistInput] ' + this.i18n.playList.error.processMediaItemFailed, error);
            showMessage(error instanceof Error ? error.message : this.i18n.playList.error.processMediaFailed);
            throw error;
        }
    }

    /**
     * 处理链接提交
     * @param url 媒体链接
     * @param inputValue 输入框绑定值引用
     */
    async handleSubmit(url: string, inputValue?: {value: string}): Promise<void> {
        if (!url) {
            showMessage(this.i18n.playList.error.emptyUrl);
            return;
        }
        
        await this.handleMediaAdd(url);
        
        // 清空输入框
        if (inputValue) {
            inputValue.value = '';
        }
    }
}