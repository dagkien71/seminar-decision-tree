(() => {
  const EXAMPLES = {
    max_depth: {
      title: "max_depth — giới hạn độ sâu",
      html: `
        <p class="ex-scene">
          <strong>Ý tưởng:</strong> không cho cây hỏi quá nhiều tầng.
        </p>
        <div class="ex-cols">
          <div class="ex-box bad">
            <h3>Không giới hạn</h3>
            <p>Cây hỏi: Thời tiết → Độ ẩm → Gió → màu áo → mang dù…</p>
            <p>→ Đúng gần hết trên bảng train, nhưng hay sai với người mới.</p>
          </div>
          <div class="ex-box good">
            <h3>Đặt max_depth = 2</h3>
            <p>Cây chỉ được hỏi tối đa 2 lần, rồi phải kết luận.</p>
            <p>→ Ví dụ: Thời tiết → Độ ẩm → Có / Không.</p>
          </div>
        </div>
        <p class="ex-takeaway">
          <strong>Kết luận:</strong> hạn chế độ sâu = quy tắc ngắn hơn, ít học nhiễu hơn.
        </p>
      `,
    },
    min_leaf: {
      title: "min_samples_leaf — số mẫu tối thiểu ở mỗi lá",
      html: `
        <p class="ex-scene">
          <strong>Ý tưởng:</strong> mỗi lá phải dựa trên đủ nhiều mẫu, không tách theo 1 người lẻ.
        </p>
        <div class="ex-cols">
          <div class="ex-box bad">
            <h3>Cho phép lá 1 mẫu</h3>
            <p>Có đúng 1 người “Mưa + thứ Ba” → Có đi.</p>
            <p>→ Cây tạo một lá riêng cho người đó (học case đặc biệt).</p>
          </div>
          <div class="ex-box good">
            <h3>Đặt min_samples_leaf = 5</h3>
            <p>Lá phải có ít nhất 5 mẫu mới được tách.</p>
            <p>→ Không tách riêng 1 người; kết luận phải đại diện cho nhóm.</p>
          </div>
        </div>
        <p class="ex-takeaway">
          <strong>Kết luận:</strong> tránh lá quá nhỏ = tránh nhớ từng trường hợp nhiễu.
        </p>
      `,
    },
    pruning: {
      title: "Pruning — cắt nhánh thừa",
      html: `
        <p class="ex-scene">
          <strong>Ý tưởng:</strong> để cây mọc đã, rồi cắt những nhánh không giúp đoán dữ liệu mới.
        </p>
        <div class="ex-cols">
          <div class="ex-box bad">
            <h3>Giữ nhánh “mang balo?”</h3>
            <p>Trên train: đúng thêm một chút.</p>
            <p>Trên test: lại sai nhiều hơn → nhánh đang học nhiễu.</p>
          </div>
          <div class="ex-box good">
            <h3>Cắt nhánh đó</h3>
            <p>Nhánh không cải thiện dự đoán trên dữ liệu mới → bỏ.</p>
            <p>→ Cây gọn hơn, khái quát tốt hơn.</p>
          </div>
        </div>
        <p class="ex-takeaway">
          <strong>Kết luận:</strong> pruning = tỉa sau khi mọc.
          Khác <code>max_depth</code> (chặn độ sâu ngay từ đầu).
        </p>
      `,
    },
    ensemble: {
      title: "Ensemble — nhiều cây bỏ phiếu",
      html: `
        <p class="ex-scene">
          <strong>Ý tưởng:</strong> không dựa một cây; dùng nhiều cây rồi lấy ý kiến đa số.
        </p>
        <div class="ex-cols">
          <div class="ex-box bad">
            <h3>Một Decision Tree</h3>
            <p>Một cây có thể chọn nhầm câu hỏi nhiễu.</p>
            <p>→ Sai một chỗ là cả mô hình lệch theo.</p>
          </div>
          <div class="ex-box good">
            <h3>Nhiều cây (Random Forest)</h3>
            <p>Mỗi cây học một phần dữ liệu khác nhau, rồi bỏ phiếu.</p>
            <p>→ Tín hiệu thật (Thời tiết…) được giữ; nhiễu bị át.</p>
          </div>
        </div>
        <p class="ex-takeaway">
          <strong>Kết luận:</strong> ensemble giảm overfitting bằng cách “không tin một cây duy nhất”.
        </p>
      `,
    },
  };

  const modal = document.getElementById("ex-modal");
  const titleEl = document.getElementById("ex-modal-title");
  const bodyEl = document.getElementById("ex-modal-body");
  if (!modal) return;

  function openEx(id) {
    const ex = EXAMPLES[id];
    if (!ex) return;
    titleEl.textContent = ex.title;
    bodyEl.innerHTML = ex.html;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".ex-modal-close")?.focus();
  }

  function closeEx() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  document.querySelectorAll(".ex-link[data-fix]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEx(btn.dataset.fix);
    });
  });

  modal.querySelectorAll("[data-close-ex]").forEach((el) => {
    el.addEventListener("click", closeEx);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      e.preventDefault();
      closeEx();
    }
  });

  const prevIsOpen = window.isAppModalOpen;
  window.isAppModalOpen = () => {
    const appOpen = typeof prevIsOpen === "function" ? prevIsOpen() : false;
    return appOpen || !modal.hidden;
  };
})();
