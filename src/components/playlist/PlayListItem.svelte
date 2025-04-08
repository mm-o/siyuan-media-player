<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { MediaItem } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';

    // 组件属性
    export let item: MediaItem;
    export let currentItem: MediaItem | null = null;
    export let i18n: any;
    export let tabs: any[] = [];
    export let activeTabId: string = '';
    
    // 组件状态
    let isExpanded = false;
    let videoParts: any[] = [];
    let isLoadingParts = false;
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        play: { item: MediaItem };
        playPart: { item: MediaItem; part: any };
        togglePin: { item: MediaItem };
        toggleFavorite: { item: MediaItem };
        remove: { item: MediaItem };
    }>();
    
    // 是否为当前播放项，包括分P
    $: isPlaying = currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    
    /**
     * 点击处理
     */
    async function handleClick() {
        // 处理B站视频分P
        if (item.type === 'bilibili' && item.bvid) {
            // 如果有分P，则切换展开/收起状态
            if (await hasParts()) {
                toggleExpand();
                return;
            }
        }
        
        // 单次点击不做任何操作，双击通过父组件处理
    }
    
    /**
     * 检查是否有分P
     */
    async function hasParts() {
        // 如果已经加载过分P信息，直接返回结果
        if (videoParts.length > 0) {
            return videoParts.length > 1;
        }
        
        // 如果正在加载，等待加载完成
        if (isLoadingParts) {
            return false;
        }
        
        // 加载分P信息
        if (item.type === 'bilibili' && item.bvid) {
            try {
                isLoadingParts = true;
                videoParts = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
                isLoadingParts = false;
                return videoParts.length > 1;
            } catch (error) {
                console.error("获取视频分P列表失败", error);
                isLoadingParts = false;
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * 切换展开/收起状态
     */
    function toggleExpand() {
        isExpanded = !isExpanded;
    }
    
    /**
     * 播放分P
     */
    function playPart(part: any) {
        const partId = `${item.id}-p${part.page}`;
        const partTitle = `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`;
        const partItem = {
            ...item,
            id: partId,
            title: partTitle,
            cid: String(part.cid)
        };
        
        dispatch('playPart', { item: partItem, part });
    }
    
    /**
     * 显示右键菜单
     */
    function showContextMenu(event: MouseEvent) {
        const menu = new Menu("mediaItemMenu");
        
        menu.addItem({
            icon: "iconPlay",
            label: i18n.playList.menu.play,
            click: () => dispatch('play', { item })
        });
        
        menu.addItem({
            icon: "iconPin",
            label: item.isPinned ? i18n.playList.menu.unpin : i18n.playList.menu.pin,
            click: () => dispatch('togglePin', { item })
        });
        
        menu.addItem({
            icon: "iconHeart",
            label: item.isFavorite ? i18n.playList.menu.unfavorite : i18n.playList.menu.favorite,
            click: () => dispatch('toggleFavorite', { item })
        });
        
        menu.addSeparator();
        
        menu.addItem({
            icon: "iconTrashcan",
            label: i18n.playList.menu.delete,
            click: () => dispatch('remove', { item })
        });
        
        menu.open({ x: event.clientX, y: event.clientY });
    }
</script>

<div 
    class="playlist-item" 
    class:playing={isPlaying}
    on:click={handleClick}
    on:dblclick={() => dispatch('play', { item })}
    on:contextmenu|preventDefault={showContextMenu}
>
    <div class="item-content">
        <div class="item-thumbnail">
            <img src={item.thumbnail || '/plugins/siyuan-media-player/thumbnails/default.svg'} alt={item.title} />
            {#if item.duration}
                <div class="duration">{item.duration}</div>
            {/if}
        </div>
        <div class="item-info">
            <div class="item-title">{item.title}</div>
            {#if item.artist}
                <div class="item-artist">
                    {#if item.artistIcon}
                        <img class="artist-icon" src={item.artistIcon} alt={item.artist} />
                    {/if}
                    <span>{item.artist}</span>
                </div>
            {/if}
            {#if item.url}
                <div class="item-url">{item.url}</div>
            {/if}
        </div>
    </div>
    
    <!-- 分P列表 - 均匀排列 -->
    {#if isExpanded && videoParts.length > 1}
        <div class="item-parts">
            {#each videoParts as part}
                <button 
                    class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" 
                    on:click|stopPropagation={() => playPart(part)}
                    title="{part.part || `P${part.page}`}"
                >
                    {part.page}
                </button>
            {/each}
        </div>
    {/if}
</div> 