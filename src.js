"use strict";
(function (microcms) {
  /** 
   * DOMを取得する。
  */
  const myblog = document.getElementById('my-blog'),
    tplWrap = document.getElementById('my-blog-wrap'),
    tplParts = document.getElementById('my-blog-parts'),
    tplArchive = document.getElementById('my-blog-content-archive');

  /** 
   * history.stateを管理するオブジェクト
   * @example
   * stateObj.bySearch = location.search;
   * window.history.pusState({}, "", stateObj.searchParams.toString());
  */
  const stateObj = {
    _params: {},
    _check({ type, page, id }) {
      const params = new URLSearchParams();
      page = (page > 0) ? page : 1;
      type = id ? type : 'archive';
      switch (type) {
        case 'post':
          params.set('myblogtype', 'post');
          params.set('myblogid', id);
          break;
        case 'archive':
          params.set('myblogtype', 'archive');
          params.set('myblogpage', page);
          break;
        case 'category':
          params.set('myblogtype', 'category');
          params.set('myblogid', id);
          params.set('myblogpage', page);
          break;
        default:
          params.set('myblogtype', 'archive');
          params.set('myblogpage', 1);
      }
      this._params = params;
    },
    set bySearch(string) {
      const params = new URLSearchParams(string);
      this._check({
        type: params.get('myblogtype'),
        page: parseInt(params.get('myblogpage')),
        id: params.get('myblogid'),
      });
    },
    get obj() {
      const state = {}
      this._params.forEach((val, key) => {
        state[key] = val;
      });
      return state;
    },
    get searchParams() {
      return this._params;
    },
  }

  /**
   * クリックされたら実行する。preventDefaultして、表示を変更して、historyAPIを変更する。
   * @param {Event} ev
   */
  function clickHandler(ev) {
    const atag = ev.target.closest('a');
    if (!atag) return;
    const url = new URL(atag.href);
    if (url && url.origin === location.origin && url.pathname === location.pathname) {
      ev.preventDefault();
      const searchParams = new URLSearchParams(location.search);
      const state = (searchParams.get('myblogtype') === 'category') ? {categoryName: atag.textContent} : {}; 
      window.history.pushState(state, '', url.toString());
      displayMyblog();
    }
  }
  /**
  * 表示処理
  */
  function displayMyblog() {
    /**
      * fetchの引数（URLとヘッダー）を作る
      * @param {URLSearchParams} locationParams
      * @returns {Array} ['url_String', {header: {microcms_api_key}}]
      */
    const createFetchParam = (locationParams) => {
      const fetchURL = new URL( `https://${microcms.serviceid}.microcms.io` );
      const fetchParams = new URLSearchParams();
      const offset = ()=>{
        const nowPage = locationParams.get('myblogpage');
        return microcms.limit * (nowPage - 1);
      }
      switch ( locationParams.get('myblogtype') ) {
        case 'post':
          fetchURL.pathname = `/api/v1/${microcms.endpoint}/${locationParams.get('myblogid')}`;
          break;
        case 'category':
          fetchURL.pathname = `/api/v1/${microcms.endpoint}`;
          fetchParams.set('offset', offset());
          fetchParams.set('limit', microcms.limit);
          fetchParams.set('filters', `category[equals]${locationParams.get('myblogid')}`);
          break;
        default:
          fetchURL.pathname = `/api/v1/${microcms.endpoint}`;
          fetchParams.set('offset', offset());
          fetchParams.set('limit', microcms.limit);
      }

      fetchURL.search = fetchParams.toString();
      const headers = {
        'X-MICROCMS-API-KEY': microcms.apikey
      }
      return [fetchURL.toString(), { headers }];
    }
    /** 
     * <h1>に入るtitleを返す
     * @param {String} type
     * @param {Object} json
     * @returns {String}
    */
    const createTitle = (type, json) => {
      let title;
      switch (type) {
        case 'post':
          title = json.title;
          break;
        case 'category':
          title = json.contents[0].category.name;
          break;
        case 'archive':
        default:
          title = '記事一覧';
      }
      return title;
    }
    /** 
     * パンくずリストとなるFragmentを返す
     * @param {String} type
     * @param {Object} json
     * @param {Object} parts
     * @returns {DocumentFragment}
    */
    const createBread = (type, json, parts) => {
      const bread = parts.querySelector(`.parts-bread-${type}`);
      if (!bread) return document.createDocumentFragment();
      switch (type) {
        case 'post':
          bread.querySelector('.post-title').textContent = json.title;
          break;
        case 'category':
          bread.querySelector('.category-title').textContent = json.contents[0].category.name;
          break;
        case 'archive':
        default:
      }
      return bread;
    }
    /** 
     * メインコンテンツとなるFragmentを返す
     * @param {String} type
     * @param {Object} json
     * @param {Object} parts
     * @param {Object} template
     * @returns {DocumentFragment}
    */
    const createContent = (type, json, parts, template) => {
      const content = document.createDocumentFragment();
      console.log(json);
      switch (type) {
        case 'post':
          const contentPost = parts.querySelector('.parts-content-post');
          if(json.category) {
            const anch = contentPost.querySelector('.post-category a');
            anch.textContent = json.category.name;
            anch.href = `?myblogtype=category&myblogpage=1&myblogid=${json.category.id}`;
          } else {
            contentPost.querySelector('.post-category').style.display = 'none';
          }
          contentPost.querySelector('.post-updateat').textContent = json.updatedAt;
          contentPost.querySelector('.post-updateat').datetime = json.updatedAt;
          contentPost.querySelector('.post-content').innerHTML = json.content;
          content.appendChild(contentPost)
          break;
        case 'archive':
        case 'category':
          json.contents.forEach(archive => {
            const clone = template.content.cloneNode(true);
            const url = new URL(location.href);
            url.search = new URLSearchParams({
              myblogtype: 'post',
              myblogid: archive.id,
            });
            clone.querySelector('.archive-url').href = url.toString();
            clone.querySelector('.archive-title').textContent = archive.title;
            clone.querySelector('.archive-updateat').datetime = ``;
            clone.querySelector('.archive-updateat').textContent = archive.updatedAt;
            if (archive.eyecatch) {
              const img = clone.querySelector('.eyecatch-img');
              const imgURL = new URL(archive.eyecatch.url);
              const imgURLSearch = new URLSearchParams({ w: 400 });
              imgURL.search = imgURLSearch.toString();
              img.src = imgURL.toString();
              img.width = archive.eyecatch.width;
              img.height = archive.eyecatch.height;
              img.alt = archive.title;
              img.style.display = `block`;
            } else {
              clone.querySelector('.eyecatch-noimg').style.display = `block`;
            }
            const category = clone.querySelector('.archive-category');
            if(archive.category) {
              const anc = document.createElement('a');
              anc.href = `?myblogtype=category&myblogpage=1&myblogid=${archive.category.id}`;
              anc.textContent = archive.category.name;
              category.appendChild(anc);
            }else {
              const span = document.createElement('span');
              span.textContent = 'その他';
              category.appendChild(span);
            }
            content.appendChild(clone);
          });
          break;
        default:
      }
      return content;
    }
    /** 
     * ページャーとなるFragmentを返す
     * @param {String} type
     * @param {Object} json
     * @param {Object} parts
     * @returns {DocumentFragment}
    */
    const createPager = (type, json, parts) => {
      if (type === 'category') {
        type = 'archive';
      }
      const pager = parts.querySelector(`.parts-pager-${type}`);
      if (pager) {
        if (type === 'archive') {
          const nowPage = ((json.offset / json.limit) | 0) + 1;
          const totalPage = (((json.totalCount - 1) / json.limit) | 0) + 1;
          if (nowPage === 1) {
            pager.querySelector('.pager-first').style.display = 'none';
            pager.querySelector('.pager-prev').style.display = 'none';
          } else {
            pager.querySelector('.pager-first').href = '?';
            pager.querySelector('.pager-prev').href = `?myblogtype=archive&myblogpage=${nowPage - 1}`;
          }
          pager.querySelector('.pager-now').textContent = `${nowPage} / ${totalPage}`;
          if (nowPage < totalPage) {
            pager.querySelector('.pager-next').href = `?myblogtype=archive&myblogpage=${nowPage + 1}`;
            pager.querySelector('.pager-last').href = `?myblogtype=archive&myblogpage=${totalPage}`;
          } else if(nowPage === totalPage) {
            pager.querySelector('.pager-next').style.display = 'none';
            pager.querySelector('.pager-last').style.display = 'none';
          } else {
            throw new Error(`${nowPage}ページ目は存在しません`);
          }
        }
        return pager;
      } else {
        return document.createDocumentFragment();
      }
    }
    const changeElement = (oldElement, newElement) => {
      const parent = oldElement.parentNode;
      parent.insertBefore(newElement, oldElement);
      parent.removeChild(oldElement);
    }
    // 実行
    while (myblog.firstChild) {
      myblog.removeChild(myblog.firstChild);
    }
    stateObj.bySearch = location.search;
    const fetchParam = createFetchParam(stateObj.searchParams);
    fetch(...fetchParam)
      .then(res => res.json())
      .then(json => {
        const cloneWrap = tplWrap.content.cloneNode(true);
        const cloneParts = tplParts.content.cloneNode(true);
        const type = stateObj.searchParams.get('myblogtype');
        cloneWrap.querySelector('.my-blog-title').textContent = createTitle(type, json);
        const breadWrap = cloneWrap.querySelector('.my-blog-bread');
        const bread = createBread(type, json, cloneParts);
        breadWrap.textContent = '';
        breadWrap.appendChild(bread);
        const contentWrap = cloneWrap.querySelector('.my-blog-content');
        const content = createContent(type, json, cloneParts, tplArchive);
        contentWrap.textContent = '';
        contentWrap.appendChild(content);
        const pagerWrap = cloneWrap.querySelector('.my-blog-pager');
        const pager = createPager(type, json, cloneParts);
        pagerWrap.textContent = '';
        pagerWrap.appendChild(pager);
        myblog.appendChild(cloneWrap);
      })
      .catch(err => {
        console.error(err);
        myblog.append('エラーが発生しました。');
      });
  }

  // 実行
  displayMyblog();
  myblog.addEventListener('click', clickHandler, false);
  window.addEventListener('popstate', displayMyblog, false);
})(microcms);
