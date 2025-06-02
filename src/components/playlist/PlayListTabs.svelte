<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { Menu, showMessage } from "siyuan";
    import type { PlaylistConfig as BasePlaylistConfig } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { AListManager } from '../../core/alist';

    interface PlaylistConfig extends BasePlaylistConfig {
        isEditing?: boolean;
        folderPath?: string;
    }
    
    export let tabs: PlaylistConfig[] = [];
    export let activeTabId = 'default';
    export let i18n: any;
    export let configManager: any;
    
    // 常量
    const MEDIA_REGEX = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i;
    const PREFIX = {tab: 'tab', folder: 'folder', bili: 'bili-fav', siyuan: 'siyuan'};
    const FIXED_ALIST_ID = 'alist-main';
    const DIRECTORY_TAB_ID = 'directory';
    
    let isAddingTab = false;
    let newTabInput: HTMLInputElement;
    
    const dispatch = createEventDispatcher();
    const updateTabs = () => dispatch('tabsUpdate', {tabs});
    $: activeTab = tabs.find(t => t.id === activeTabId);
    
    // 工具函数
    const isElectron = () => window.navigator.userAgent.includes('Electron');
    const getDialog = () => isElectron() ? window.require('@electron/remote').dialog : null;
    const addMedia = (url, autoPlay = false, fromFileSelector = false) => 
        dispatch('addMedia', {url, options: {autoPlay, fromFileSelector}}) || true;
    
    // Pro功能检查 - 精简版
    const needPro = fn => e => configManager.getConfig()?.settings?.pro?.enabled ? fn(e) : showMessage(i18n?.pro?.notEnabled || "此功能需要Pro版本");
    
    // 核心功能
    function setActiveTab(id) {
        if (id === activeTabId) return;
        activeTabId = id;
        dispatch('tabChange', {tabId: id});
        
        if (id === DIRECTORY_TAB_ID) {
            // 目录标签展示所有标签
            const directoryTab = tabs.find(t => t.id === DIRECTORY_TAB_ID);
            if (directoryTab) {
                directoryTab.items = tabs
                    .filter(tab => tab.id !== DIRECTORY_TAB_ID)
                    .map(tab => ({
                        id: `directory-${tab.id}`,
                        title: tab.name,
                        type: 'directory',
                        url: `#${tab.id}`,
                        targetTabId: tab.id,
                        is_dir: true
                    }));
                updateTabs();
            }
        } else if (id.startsWith(FIXED_ALIST_ID)) {
            setTimeout(() => {
                const tab = tabs.find(t => t.id === id);
                (tab && AListManager.getConfig()?.connected) 
                    ? loadAListFolder(tab.path || tab.alistPath || '/') 
                    : initAList();
            }, 10);
        }
    }

    function addTab(prefix, name) {
        const id = `${prefix}-${Date.now()}`;
        tabs = [...tabs, {id, name, items: []}];
        updateTabs();
        setActiveTab(id);
        return id;
    }

    function saveTab(event, tab = null) {
        if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
        
        const input = event.target as HTMLInputElement;
        const newName = input.value.trim();
        
        tab ? tabs = tabs.map(t => t.id === tab.id ? {...t, name: newName || t.name, isEditing: false} : t)
            : newName && addTab(PREFIX.tab, newName);
        
        isAddingTab = false;
        input.value = '';
        updateTabs();
    }

    // 标签菜单
    function showTabMenu(e, tab) {
        if (tab.id === DIRECTORY_TAB_ID) return;
        
        const menu = new Menu("tabMenu");
        
        if (!tab.isFixed) {
            menu.addItem({
                icon: "iconEdit",
                label: i18n.playList.menu.rename,
                click: () => {
                    tabs = tabs.map(t => ({...t, isEditing: t.id === tab.id}));
                    updateTabs();
                    setTimeout(() => (document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement)?.focus(), 0);
                }
            });
        }
        
        menu.addItem({
            icon: "iconRefresh",
            label: i18n.playList.menu.refresh || "刷新",
            click: () => refreshTab(tab)
        });
        
        menu.addItem({
            icon: "iconClear",
            label: i18n.playList.menu.clear,
            click: () => {
                tabs = tabs.map(t => t.id === tab.id ? {...t, items: []} : t);
                updateTabs();
                showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
            }
        });

        if (!tab.isFixed) {
            menu.addItem({
                icon: "iconTrashcan",
                label: i18n.playList.menu.delete,
                click: () => {
                    tabs = tabs.filter(t => t.id !== tab.id);
                    activeTabId === tab.id && setActiveTab('default');
                    updateTabs();
                }
            });
        }
        
        menu.open({x: e.clientX, y: e.clientY});
    }

    // 添加菜单
    function showAddMenu(e) {
        const menu = new Menu("addMenu");
        
        [
            {icon: "iconAdd", label: i18n.playList.menu.addNewTab, 
             click: () => { isAddingTab = true; setTimeout(() => newTabInput?.focus(), 0); }},
            {icon: "iconFolder", label: i18n.playList.menu.addLocalFolder || "添加本地文件夹", 
             click: () => addLocalFolder(false)},
            {icon: "iconImage", label: i18n.playList.menu.addSiyuanAssets || "添加思源空间", 
             click: () => addLocalFolder(true)},
            {icon: "iconCloud", label: i18n.playList.menu.addAList, click: needPro(initAList)},
            {icon: "iconHeart", label: i18n.playList.menu.addBilibiliFavorites, 
             click: needPro(() => showBiliFavs({x: e.clientX, y: e.clientY}))}
        ].forEach(item => menu.addItem(item));
        
        menu.open({x: e.clientX, y: e.clientY});
    }

    // 刷新标签
    function refreshTab(tab) {
        if (!tab) return;
        
        try {
            // 清空当前列表
            tab.items = [];
            updateTabs();
            
            if (tab.id === DIRECTORY_TAB_ID) {
                setActiveTab(DIRECTORY_TAB_ID);
                return;
            }
            
            // 获取媒体源类型和路径
            const sourceType = tab.sourceType || (
                tab.id.startsWith(PREFIX.folder) ? 'folder' :
                tab.id.startsWith(PREFIX.siyuan) ? 'siyuan' :
                tab.id.startsWith(PREFIX.bili) ? 'bilibili' :
                tab.id.startsWith('alist-') ? 'alist' : ''
            );
            
            const path = tab.path || (
                (tab.id.startsWith(PREFIX.folder) || tab.id.startsWith(PREFIX.siyuan)) ? tab.folderPath :
                tab.id.startsWith('alist-') ? tab.alistPath :
                tab.id.startsWith(PREFIX.bili) ? tab.id.split('-')[1] : ''
            );
            
            // 保存sourceType和path
            if (!tab.sourceType && sourceType) tab.sourceType = sourceType;
            if (!tab.path && path) tab.path = path;
            updateTabs();
            
            // 根据类型刷新内容
            if ((sourceType === 'folder' || sourceType === 'siyuan') && path) {
                refreshLocalFolder(path, sourceType);
            } else if (sourceType === 'bilibili' && path) {
                refreshBiliFav(path);
            } else if (sourceType === 'alist' && path) {
                refreshAList(tab, path);
            } else {
                dispatch('reload');
                showMessage(i18n.playList.message.configRefreshed || "已刷新配置");
            }
        } catch (e) {
            console.error("刷新失败:", e);
            showMessage(i18n.playList.error.refreshFailed || "刷新失败");
        }
    }
    
    // 刷新本地文件夹
    function refreshLocalFolder(path, sourceType) {
        if (!isElectron()) return showMessage("此功能仅在思源客户端中可用");
        
        const fs = window.require('fs'), pathModule = window.require('path');
        let count = 0;
        
        (function scan(dir) {
            try {
                fs.readdirSync(dir).forEach(file => {
                    const fullPath = pathModule.join(dir, file);
                    fs.statSync(fullPath).isDirectory()
                        ? scan(fullPath)
                        : MEDIA_REGEX.test(file) && addMedia(`file://${fullPath.replace(/\\/g, '/')}`, false, true) && count++;
                });
            } catch (e) {
                console.error("扫描失败:", dir);
            }
        })(path);
        
        const isSiyuan = sourceType === 'siyuan';
        const msgKey = count ? (isSiyuan ? 'siyuanAssetsRefreshed' : 'folderRefreshed') 
                             : (isSiyuan ? 'siyuanAssetsRefreshedEmpty' : 'folderRefreshedEmpty');
        
        showMessage(i18n.playList.message[msgKey]?.replace('${count}', count.toString()) || 
                   `已刷新${count ? `，添加了${count}个媒体文件` : "，未发现新媒体文件"}`);
    }
    
    // 刷新B站收藏夹
    function refreshBiliFav(path) {
        showMessage(i18n.playList.message.processingFavorites || "正在处理收藏夹...");
        BilibiliParser.getFavoritesList(path, configManager.getConfig())
            .then(({items}) => {
                let count = 0;
                items?.forEach(item => {
                    try { addMedia(`https://www.bilibili.com/video/${item.bvid}`, false, false) && count++; } catch {}
                });
                
                showMessage((i18n.playList.message.favoritesRefreshed || `已刷新收藏夹，添加了${count}个视频`)
                    .replace('${count}', count.toString()));
            })
            .catch(() => showMessage(i18n.playList.error.processFavoritesFailed || "刷新收藏夹失败"));
    }
    
    // 刷新AList
    function refreshAList(tab, path) {
        AListManager.createMediaItemsFromDirectory(path)
            .then(items => {
                tab.items = items;
                updateTabs();
                showMessage(i18n.playList.message.alistRefreshed || "已刷新AList目录");
            })
            .catch(() => showMessage(i18n.playList.error.refreshAListFailed || "刷新AList目录失败"));
    }

    // 添加本地文件夹
    async function addLocalFolder(isSiyuanAssets = false) {
        if (!isElectron()) return showMessage("此功能仅在思源客户端中可用");

        try {
            let folderPath, folderName;
            
            if (isSiyuanAssets) {
                // 获取思源assets路径
                const workspaceDir = window.siyuan?.config?.system?.workspaceDir;
                if (!workspaceDir) return showMessage("无法获取思源工作空间路径");
                
                const path = window.require('path');
                folderPath = path.join(workspaceDir, 'data/assets');
                folderName = "思源空间";
            } else {
                // 用户选择本地文件夹
                const result = await getDialog().showOpenDialog({
                    properties: ['openDirectory', 'createDirectory']
                });

                if (result.canceled || !result.filePaths.length) return;

                folderPath = result.filePaths[0];
                folderName = folderPath.split(/[\\/]/).pop();
            }
            
            // 创建标签并扫描文件
            const fs = window.require('fs'), path = window.require('path');
            const prefix = isSiyuanAssets ? PREFIX.siyuan : PREFIX.folder;
            const tabId = addTab(prefix, folderName);
            const tab = tabs.find(t => t.id === tabId);
            
            if (tab) {
                tab.path = folderPath;
                tab.sourceType = isSiyuanAssets ? 'siyuan' : 'folder';
                tab.folderPath = folderPath; // 保留兼容性
                updateTabs();
                
                let count = 0;
                (function scan(dir) {
                    try {
                        fs.readdirSync(dir).forEach(file => {
                            const fullPath = path.join(dir, file);
                            fs.statSync(fullPath).isDirectory()
                                ? scan(fullPath)
                                : MEDIA_REGEX.test(file) && addMedia(`file://${fullPath.replace(/\\/g, '/')}`, false, true) && count++;
                        });
                    } catch (e) {
                        console.error("扫描失败:", dir);
                    }
                })(folderPath);
                
                const msgKey = isSiyuanAssets ? 'siyuanAssetsAdded' : 'folderAdded';
                count > 0 && showMessage((i18n.playList.message[msgKey] || `已添加${count}个媒体文件`)
                    .replace('${name}', folderName)
                    .replace('${count}', count.toString()));
            }
        } catch {
            showMessage(i18n.playList.error.selectFolderFailed);
        }
    }

    // B站功能
    async function showBiliFavs(pos) {
        try {
            const config = await configManager.getConfig();
            if (!config.bilibiliLogin?.userInfo?.mid) return showMessage(i18n.playList.error.needBiliLogin);
            
            const folders = await BilibiliParser.getUserFavoriteFolders(config);
            if (!folders?.length) return showMessage(i18n.playList.error.emptyFavFolders);
            
            const menu = new Menu("biliFavs");
            folders.forEach(folder => {
                menu.addItem({
                    icon: "iconHeart",
                    label: `${folder.title} (${folder.media_count})`,
                    click: needPro(() => addBiliFav(folder.id.toString(), folder.title))
                });
            });
            
            menu.open(pos);
        } catch {
            showMessage(i18n.playList.error.getFavFoldersFailed);
        }
    }

    async function addBiliFav(id, title) {
        showMessage(i18n.playList.message.processingFavorites);
        try {
            const {title: favTitle, items} = await BilibiliParser.getFavoritesList(id, await configManager.getConfig());
            if (!items?.length) return showMessage(i18n.playList.error.emptyFavorites);
            
            const tabId = addTab(PREFIX.bili, title || favTitle);
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                tab.path = id;
                tab.sourceType = 'bilibili';
                updateTabs();
            }
            
            let count = 0;
            
            for (const item of items) {
                try { addMedia(`https://www.bilibili.com/video/${item.bvid}`, false, false) && count++; } catch {}
            }
            
            showMessage(i18n.playList.message.favoritesAdded
                .replace('${name}', title || favTitle)
                .replace('${count}', count.toString()));
        } catch {
            showMessage(i18n.playList.error.processFavoritesFailed);
        }
    }

    // AList功能
    async function loadAListFolder(path = '/'): Promise<void> {
        try {
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab || !tab.id.startsWith(FIXED_ALIST_ID)) return;
            
            if (!AListManager.getConfig()?.token) return showMessage("未连接到AList服务器");
            
            tab.path = path;
            tab.alistPath = path;  // 保留兼容性
            tab.sourceType = 'alist';
            
            tab.alistPathParts = path.split('/').filter(Boolean)
                .map((part, i, arr) => ({ name: part, path: '/' + arr.slice(0, i + 1).join('/') }));
            
            tab.items = await AListManager.createMediaItemsFromDirectory(path);
            updateTabs();
        } catch {
            showMessage('获取文件列表失败');
        }
    }

    async function initAList() {
        try {
            if (await AListManager.initFromConfig(await configManager.getConfig())) {
                const alistTab = tabs.find(t => t.id.startsWith(FIXED_ALIST_ID));
                if (alistTab) {
                    setActiveTab(alistTab.id);
                } else {
                    const id = `${FIXED_ALIST_ID}-${Date.now()}`;
                    tabs = [...tabs, {
                        id, name: 'AList', items: [], path: '/', 
                        alistPath: '/', sourceType: 'alist'
                    }];
                    updateTabs();
                    setActiveTab(id);
                }
            } else {
                showMessage("请配置AList");
            }
        } catch {
            showMessage("AList连接失败");
        }
    }

    // 事件处理
    onMount(() => {
        const handlers = {
            alistPathPlay: ((event: CustomEvent) => {
                try {
                    const { path, startTime, endTime } = event.detail;
                    AListManager.createMediaItemFromPath(path, { startTime, endTime })
                        .then(mediaItem => {
                            window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: mediaItem }));
                        });
                } catch {
                    showMessage('播放失败');
                }
            }) as EventListener,
            
            addAListTab: ((event: CustomEvent) => {
                try {
                    const path = event.detail?.path;
                    if (!path) return;
                    
                    AListManager.initFromConfig(configManager.getConfig()).then(connected => {
                        if (!connected) return showMessage('未连接到AList服务器');
                        
                        const folderName = path.split('/').pop() || 'AList';
                        const id = `${FIXED_ALIST_ID}-${Date.now()}`;
                        tabs = [...tabs, {
                            id, name: folderName, items: [], 
                            path: path, alistPath: path, sourceType: 'alist'
                        }];
                        updateTabs();
                        setActiveTab(id);
                    });
                } catch {
                    showMessage('添加AList标签失败');
                }
            }) as EventListener
        };
        
        // 注册事件与初始化AList
        Object.entries(handlers).forEach(([event, handler]) => window.addEventListener(event, handler));
        AListManager.initFromConfig(configManager.getConfig()).then(connected => {
            connected && activeTab?.id.startsWith(FIXED_ALIST_ID) && 
            loadAListFolder(activeTab.path || activeTab.alistPath || '/');
        }).catch(() => {});
        
        return () => Object.entries(handlers).forEach(([event, handler]) => window.removeEventListener(event, handler));
    });
</script>

<!-- 标签栏 -->
<div class="playlist-tabs">
    {#each tabs as tab (tab.id)}
        {#if tab.isEditing}
            <div class="tab-edit-wrapper">
                <input id="tab-edit-{tab.id}" type="text" class="tab-input" value={tab.name}
                       on:blur={(e) => saveTab(e, tab)} on:keydown={(e) => saveTab(e, tab)}/>
            </div>
        {:else}
            <button class="tab" class:active={activeTabId === tab.id}
                    on:click={() => setActiveTab(tab.id)}
                    on:contextmenu|preventDefault={(e) => showTabMenu(e, tab)}>
                {tab.name}
            </button>
        {/if}
    {/each}
    
    <!-- 添加按钮/输入框 -->
    <div class="tab-add-wrapper">
        {#if isAddingTab}
            <input bind:this={newTabInput} type="text" class="tab-input" style="width:100px"
                   placeholder={i18n.playList.placeholder.newTab}
                   on:blur={saveTab} on:keydown={saveTab}/>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={showAddMenu}>+</button>
        {/if}
    </div>
</div>