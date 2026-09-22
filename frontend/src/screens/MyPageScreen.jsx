import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyPageScreen.css';
import { auth, storage } from '../firebase';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

// =========================================================================
// 회원정보 전용 마이페이지 (mypage_mockup.html을 React로 옮긴 버전).
// "학습 통계"(StudyStatsScreen.jsx)와는 완전히 별개 화면.
// 이름만 수정 가능, 이메일은 읽기 전용.
//
// AUTH_API_BASE: 로그인 백엔드(김동호) 포트. 8080.
// =========================================================================
const AUTH_API_BASE = 'http://localhost:8080';
// 로그아웃은 다른 화면(MainScreen.jsx, StudyStatsScreen.jsx)과 동일하게
// 8081번 포트를 쓴다 - 탈퇴(AUTH_API_BASE)와 실제로 다른 값이라 따로 뒀다.
const LOGOUT_API_BASE = 'http://localhost:8081';
// 프로필 사진은 Firebase Storage(profile_images/{uid}/{시각}.jpg)에 실제 파일로
// 올리고, Firestore users/{uid} 문서에는 그 파일의 다운로드 URL(profileImageUrl)만
// 저장한다. 같은 계정으로 로그인한 웹/앱이 인터넷만 되면 항상 같은 사진을 본다 -
// 자체 서버 방식과 달리 같은 와이파이일 필요가 없다. 바꿀 때마다 이전 파일을
// 지우지 않고 새 파일로 남겨서 users/{uid}/profile_photos 서브컬렉션에 기록해두고,
// "이전 사진" 갤러리에서 다시 골라 쓸 수 있게 한다. Storage는 Blaze(종량제) 요금제부터
// 켜지는데, 이 정도 사용량(작은 이미지 몇 장)은 무료 한도 안이라 실제 과금은 없다.
const AVATAR_SIZE = 160;
function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('이미지를 읽을 수 없어요.'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// MainScreen.jsx/StudyStatsScreen.jsx와 동일한 상단바 + 햄버거 메뉴
// (fallback 색상은 StudyStatsScreen.css :root 값과 동일 - 이 화면 CSS엔
//  그 변수가 정의돼 있지 않아서, 다른 화면을 안 거치고 바로 /mypage로
//  들어와도 깨지지 않게 기본값을 같이 적어둔다.)
const topbar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 28px',
  background: '#fff',
  borderBottom: '1px solid var(--line, #F7DCE0)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};
const hamburgerBtn = {
  position: 'fixed',
  top: 64,
  left: 28,
  zIndex: 9,
  border: 'none',
  background: 'transparent',
  fontSize: 20,
  cursor: 'pointer',
  color: 'var(--ink, #4B3B47)',
  padding: 4,
};
const sidebarOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.25)',
  zIndex: 19,
};
const sidebarPanel = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: 240,
  background: '#fff',
  borderRight: '1px solid var(--line, #F7DCE0)',
  boxShadow: '0 12px 28px -14px rgba(169,143,194,0.35)',
  zIndex: 20,
  padding: '20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const sidebarItem = {
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink, #4B3B47)',
  cursor: 'pointer',
};
const sidebarDivider = {
  height: 1,
  background: 'var(--line, #F7DCE0)',
  margin: '8px 0',
};

const Icon = {
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  mail: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
      <path d="m2 7 10 6 10-6"></path>
    </svg>
  ),
  photo: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="4"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <path d="m21 15-5-5L5 21"></path>
    </svg>
  ),
  lock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  ),
  trash: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M4 7h16"></path>
      <path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"></path>
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path>
    </svg>
  ),
};

export default function MyPageScreen() {
  const navigate = useNavigate();
  const [memberId] = useState(() => localStorage.getItem('userId'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  // 고른 사진을 바로 저장하지 않고, 미리보기에서 "완료"를 눌러야 저장한다.
  // 크롭/압축까지 미리 끝내둔 data URL이라 완료 누르면 바로 저장만 하면 된다.
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 이전에 올렸던 프로필 사진들 (최신순). "이전 사진" 갤러리에 보여준다.
  const [photoHistory, setPhotoHistory] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const photoInputRef = useRef(null);

  const loadPhotoHistory = async () => {
    try {
      const q = query(
        collection(db, 'users', memberId, 'profile_photos'),
        orderBy('uploadedAt', 'desc'),
      );
      const snap = await getDocs(q);
      setPhotoHistory(snap.docs.map((d) => d.data()));
    } catch {
      // 목록을 못 불러와도 사진 변경 자체는 계속 가능해야 하므로 조용히 무시한다.
    }
  };

  useEffect(() => {
    if (!memberId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', memberId));
      if (snap.exists()) {
        setName(snap.data().name || '');
        setEmail(snap.data().email || '');
        // profileImageUrl이 아직 없으면(예전 base64 방식으로 저장했던 계정) 그 값을 대신 보여준다.
        setProfileImageUrl(snap.data().profileImageUrl || snap.data().profileImageBase64 || '');
      }
      await loadPhotoHistory();
      setLoading(false);
    })();
  }, [memberId]);

  const handleEditName = async () => {
    const newName = window.prompt('새 이름을 입력하세요', name);
    if (!newName || newName.trim() === '') return;
    try {
      await updateDoc(doc(db, 'users', memberId), { name: newName.trim() });
      if (auth.currentUser)
        await updateProfile(auth.currentUser, { displayName: newName.trim() });
      setName(newName.trim());
      setMsg({ type: 'ok', text: '이름이 변경됐어요.' });
    } catch (e) {
      setMsg({ type: 'err', text: '이름 변경에 실패했어요: ' + e.message });
    }
  };

  const handleResetPassword = async () => {
    if (!email)
      return setMsg({ type: 'err', text: '이메일 정보를 불러오지 못했어요.' });
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg({
        type: 'ok',
        text: `${email}로 비밀번호 재설정 메일을 보냈어요.`,
      });
    } catch (e) {
      setMsg({ type: 'err', text: '메일 발송에 실패했어요: ' + e.message });
    }
  };

  const handlePhotoChange = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 연달아 골라도 change가 다시 뜨도록 초기화
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: '이미지 파일만 올릴 수 있어요.' });
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPhotoPreview(dataUrl); // 저장은 아직 안 함 - 미리보기 팝업만 띄운다
    } catch (e2) {
      setMsg({ type: 'err', text: '이미지를 처리하지 못했어요: ' + e2.message });
    }
  };

  const handleConfirmPhoto = async () => {
    setPhotoUploading(true);
    try {
      const ts = Date.now();
      const fileRef = storageRef(storage, `profile_images/${memberId}/${ts}.jpg`);
      await uploadString(fileRef, photoPreview, 'data_url');
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', memberId), { profileImageUrl: url });
      await setDoc(doc(db, 'users', memberId, 'profile_photos', String(ts)), {
        url,
        uploadedAt: ts,
      });
      setProfileImageUrl(url);
      setPhotoPreview('');
      await loadPhotoHistory(); // 방금 올린 사진이 갤러리 맨 앞에 바로 보이도록 새로고침
      setMsg({ type: 'ok', text: '프로필 사진이 변경됐어요.' });
    } catch (e2) {
      setMsg({ type: 'err', text: '프로필 사진 변경에 실패했어요: ' + e2.message });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleCancelPhoto = () => setPhotoPreview('');

  const handleSelectFromHistory = async (url) => {
    try {
      await updateDoc(doc(db, 'users', memberId), { profileImageUrl: url });
      setProfileImageUrl(url);
      setGalleryOpen(false);
      setMsg({ type: 'ok', text: '프로필 사진이 변경됐어요.' });
    } catch (e2) {
      setMsg({ type: 'err', text: '사진 선택에 실패했어요: ' + e2.message });
    }
  };

  const handleWithdraw = async () => {
    if (
      !window.confirm(
        '정말 탈퇴하시겠습니까?\n계정과 학습 데이터가 모두 삭제되며 되돌릴 수 없습니다.',
      )
    )
      return;
    try {
      await fetch(`${AUTH_API_BASE}/api/auth/withdraw`, {
        method: 'POST',
        credentials: 'include',
      });
      localStorage.removeItem('userId');
      window.location.href = '/';
    } catch (e) {
      setMsg({
        type: 'err',
        text: '탈퇴 처리 중 오류가 발생했어요: ' + e.message,
      });
    }
  };

  // MainScreen.jsx/StudyStatsScreen.jsx의 로그아웃과 동일한 로직
  const handleLogout = async () => {
    try {
      await fetch(`${LOGOUT_API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 로그아웃 요청이 실패해도 로컬 로그인 상태는 지워서 화면은 로그인 화면으로 보낸다.
    }
    localStorage.removeItem('userId');
    window.location.href = '/';
  };

  if (!memberId) {
    return (
      <div className="mypage-root">
        <p>로그인이 필요해요.</p>
      </div>
    );
  }
  if (loading) {
    return <div className="mypage-root"></div>;
  }

  return (
    <div className="mypage-root">
      <div style={topbar}>
        <img
          src="/wordmark.png"
          alt="Planit"
          style={{ height: 28, cursor: 'pointer' }}
          onClick={() => navigate('/main')}
        />
      </div>
      <button
        style={hamburgerBtn}
        title="메뉴"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>
      {sidebarOpen && (
        <>
          <div style={sidebarOverlay} onClick={() => setSidebarOpen(false)} />
          <div style={sidebarPanel}>
            <img
              src="/wordmark.png"
              alt="Planit"
              style={{
                height: 24,
                width: 'auto',
                alignSelf: 'flex-start',
                marginBottom: 12,
              }}
            />
            <span
              style={sidebarItem}
              onClick={() => {
                setSidebarOpen(false);
                navigate('/mypage');
              }}
            >
              마이페이지
            </span>
            <span
              style={sidebarItem}
              onClick={() => {
                setSidebarOpen(false);
                navigate('/study-stats');
              }}
            >
              학습 통계
            </span>
            <span
              style={sidebarItem}
              onClick={() => {
                setSidebarOpen(false);
                navigate('/chatbot');
              }}
            >
              챗봇
            </span>
            <div style={sidebarDivider} />
            <span
              style={sidebarItem}
              onClick={() => {
                setSidebarOpen(false);
                handleLogout();
              }}
            >
              로그아웃
            </span>
          </div>
        </>
      )}

      <div className="mypage-page">
        <div className="mypage-layout">
          <aside className="mypage-sidebar">
            <div className="mypage-avatar">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt="프로필 사진"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                name ? name.slice(0, 1) : 'P'
              )}
            </div>
            <div className="mypage-side-name">{name || '회원'}</div>
            <div className="mypage-side-email">{email}</div>
            <nav className="mypage-side-nav">
              <a href="#profile-card">회원 프로필</a>
              <a href="#account-card">계정 관리</a>
            </nav>
          </aside>

          <div className="mypage-content">
            {msg && <p className={`mypage-msg ${msg.type}`}>{msg.text}</p>}

            <section className="mypage-card" id="profile-card">
              <div className="mypage-card-header">회원 프로필</div>
              <div className="mypage-card-body">
                <div className="mypage-row">
                  <div className="mypage-row-label">
                    <div className="mypage-row-icon">{Icon.user}</div>
                    <div className="mypage-row-text">
                      <div className="t">이름</div>
                      <div className="d">{name}</div>
                    </div>
                  </div>
                  <button
                    className="mypage-btn mypage-btn-ghost"
                    onClick={handleEditName}
                  >
                    수정
                  </button>
                </div>
                <div className="mypage-row">
                  <div className="mypage-row-label">
                    <div className="mypage-row-icon">{Icon.mail}</div>
                    <div className="mypage-row-text">
                      <div className="t">이메일</div>
                      <div className="d">{email}</div>
                    </div>
                  </div>
                </div>
                <div className="mypage-row">
                  <div className="mypage-row-label">
                    <div className="mypage-row-icon">{Icon.photo}</div>
                    <div className="mypage-row-text">
                      <div className="t">프로필 사진</div>
                      <div className="d">
                        {profileImageUrl ? '사용자 지정 이미지 사용 중' : '기본 이미지 사용 중'}
                      </div>
                    </div>
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoFileSelected}
                  />
                  <button
                    className="mypage-btn mypage-btn-ghost"
                    onClick={() => setGalleryOpen(true)}
                    disabled={photoUploading}
                  >
                    {photoUploading ? '업로드 중...' : '변경'}
                  </button>
                </div>
              </div>
            </section>

            <section className="mypage-card" id="account-card">
              <div className="mypage-card-header">계정 관리</div>
              <div className="mypage-card-body">
                <div className="mypage-row">
                  <div className="mypage-row-label">
                    <div className="mypage-row-icon">{Icon.lock}</div>
                    <div className="mypage-row-text">
                      <div className="t">비밀번호 변경</div>
                      <div className="d">이메일로 재설정 링크를 보내드려요</div>
                    </div>
                  </div>
                  <button
                    className="mypage-btn mypage-btn-primary"
                    onClick={handleResetPassword}
                  >
                    변경
                  </button>
                </div>
                <div className="mypage-row mypage-danger-row">
                  <div className="mypage-row-label">
                    <div className="mypage-row-icon">{Icon.trash}</div>
                    <div className="mypage-row-text">
                      <div className="t">회원 탈퇴</div>
                      <div className="d">
                        탈퇴 시 모든 학습 데이터가 삭제되고 복구할 수 없어요
                      </div>
                    </div>
                  </div>
                  <button
                    className="mypage-btn mypage-btn-danger"
                    onClick={handleWithdraw}
                  >
                    탈퇴하기
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {photoPreview && (
        <>
          <div style={sidebarOverlay} onClick={handleCancelPhoto} />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 21,
              background: '#fff',
              borderRadius: 22,
              boxShadow: '0 12px 28px -14px rgba(169,143,194,0.35)',
              padding: 28,
              width: 320,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              이 사진으로 변경할까요?
            </p>
            <img
              src={photoPreview}
              alt="프로필 사진 미리보기"
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                objectFit: 'cover',
                margin: '0 auto 20px',
                display: 'block',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="mypage-btn mypage-btn-ghost"
                style={{ flex: 1 }}
                onClick={handleCancelPhoto}
                disabled={photoUploading}
              >
                취소
              </button>
              <button
                className="mypage-btn mypage-btn-primary"
                style={{ flex: 1 }}
                onClick={handleConfirmPhoto}
                disabled={photoUploading}
              >
                {photoUploading ? '저장 중...' : '완료'}
              </button>
            </div>
          </div>
        </>
      )}

      {galleryOpen && (
        <>
          <div style={sidebarOverlay} onClick={() => setGalleryOpen(false)} />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 21,
              background: '#fff',
              borderRadius: 22,
              boxShadow: '0 12px 28px -14px rgba(169,143,194,0.35)',
              padding: 28,
              width: 380,
              maxHeight: '70vh',
              overflowY: 'auto',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              프로필 사진 변경
            </p>
            <button
              className="mypage-btn mypage-btn-primary"
              style={{ width: '100%', marginBottom: 20 }}
              onClick={() => {
                setGalleryOpen(false);
                handlePhotoChange();
              }}
              disabled={photoUploading}
            >
              새 사진 선택
            </button>
            {photoHistory.length === 0 ? (
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted, #9A8A96)' }}>
                아직 이전에 올린 사진이 없어요.
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                  이전 사진 중에서 선택
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  {photoHistory.map((p) => (
                    <button
                      key={p.url}
                      onClick={() => handleSelectFromHistory(p.url)}
                      style={{
                        border:
                          p.url === profileImageUrl
                            ? '3px solid var(--brand, #A98FC2)'
                            : '1px solid var(--line, #F7DCE0)',
                        borderRadius: 12,
                        padding: 0,
                        cursor: 'pointer',
                        background: 'none',
                        lineHeight: 0,
                      }}
                      title={
                        p.uploadedAt
                          ? new Date(p.uploadedAt).toLocaleString()
                          : undefined
                      }
                    >
                      <img
                        src={p.url}
                        alt="이전 프로필 사진"
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          objectFit: 'cover',
                          borderRadius: 10,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              className="mypage-btn mypage-btn-ghost"
              style={{ width: '100%' }}
              onClick={() => setGalleryOpen(false)}
            >
              닫기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
