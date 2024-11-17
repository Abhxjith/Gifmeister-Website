import React, { useState } from 'react';
import './App.css';
import funImage from './assets/fun.png';
import { Check } from 'lucide-react';

function App() {
  const [video, setVideo] = useState(null);
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [selectedGif, setSelectedGif] = useState(null); 
  
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideo(file);
      setError('');
    } else {
      setError('Please upload a valid video file');
    }
  };

  const handleVideoChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideo(file);
      setError('');
    } else {
      setError('Please upload a valid video file');
    }
  };

  const handleUpload = async () => {
    if (!video) return;
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append("video", video);

    try {
      const response = await fetch("http://127.0.0.1:5000/upload_video", {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      setGifs(data.gifs);
    } catch (error) {
      setError('Failed to upload video. Please try again.');
      console.error("Error uploading video:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGifClick = (gif) => {
    setSelectedGif(gif); // Set the clicked gif as selected
  };

  const handleCloseModal = () => {
    setSelectedGif(null); 
  };

  const handleScroll = () => {
    const element = document.getElementById('upload');
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 300, 
        behavior: 'smooth'
      });
    }
  };
  

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-content">
          <div className="logo">Gifmeister</div>
          <ul className="nav-links">
  <li><a href="#upload" >Upload</a></li>
  <li><a href="#gallery">Gallery</a></li>
  <li><a href="#pricing">Pricing</a></li>
  <li><a href="#about">About</a></li>
</ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-image">
          <img src={funImage} alt="Hero" />
        </div>
        <div className="hero-content">
          <h1 className="hero-title">Turn Moments into Magic – Create Stunning GIFs in Seconds!</h1>
          <button className="hero-button" onClick={handleScroll}>Get Started!</button>
        </div>
      </section>

      <main className="main-content">
        <header className="header">
          <h1>Transform Videos into GIFs</h1>
          <p>Create shareable moments in seconds</p>
        </header>

        {error && (
          <div className="error-alert">
            {error}
          </div>
        )}

        <div className="upload-card" id="upload">
          <div
            className={`drop-zone ${dragActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <label htmlFor="video-upload" className="upload-label-full">
              <input
                type="file"
                onChange={handleVideoChange}
                accept="video/*"
                className="file-input"
                id="video-upload"
              />
              <div className="upload-content">
                <div className="upload-icon"></div>
                <p className="upload-label">Choose a video</p>
                <p className="upload-text">or drag and drop here</p>
                {video && (
                  <div className="selected-file">
                    Selected: {video.name}
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="upload-actions">
            <button
              onClick={handleUpload}
              disabled={!video || loading}
              className={`upload-button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Converting...
                </>
              ) : (
                'Convert to GIF'
              )}
            </button>
          </div>
        </div>

        {gifs.length > 0 && (
          <section id="gallery" className="gallery-section">
            <h2>Your GIFs</h2>
            <div className="gif-grid">
              {gifs.map((gif, index) => (
                <div key={index} className="gif-card" onClick={() => handleGifClick(gif)}>
                  <img
                    src={`http://127.0.0.1:5000${gif.path}`}
                    alt={`GIF ${index + 1}`}
                  />
                  <div className="gif-card-footer">
                    <span>GIF {index + 1}</span>
                    <a
                      href={`http://127.0.0.1:5000${gif.path}`}
                      download
                      className="download-link"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Modal for viewing large GIF */}
        {selectedGif && (
          <div className="gif-modal" onClick={handleCloseModal}>
            <div className="gif-modal-content" onClick={(e) => e.stopPropagation()}>
              <img
                src={`http://127.0.0.1:5000${selectedGif.path}`}
                alt="Selected GIF"
                className="large-gif"
              />
            </div>
          </div>
        )}
      </main>
      <section className="pricing-section" id="pricing">
  <div className="pricing-header">
    <h2>Choose Your Plan</h2>
    <p>Select the perfect plan for your GIF creation needs</p>
  </div>
  
  <div className="pricing-container">
    {[
      {
        name: 'Free',
        price: '0',
        description: 'Perfect for getting started',
        features: [
          'Convert up to 5 videos per day',
          'Basic GIF resolution',
          'Maximum 30-second clips',
          'Standard support'
        ],
        buttonText: 'Get Started',
        popular: false
      },
      {
        name: 'Pro',
        price: '499',
        description: 'Best for regular users',
        features: [
          'Convert up to 50 videos per day',
          'HD GIF resolution',
          'Maximum 2-minute clips',
          'Priority support',
          'Custom watermarks',
          'Cloud storage'
        ],
        buttonText: 'Try Pro',
        popular: true
      },
      {
        name: 'Max',
        price: '999',
        description: 'For power users & teams',
        features: [
          'Unlimited conversions',
          '4K GIF resolution',
          'No length restrictions',
          '24/7 Premium support',
          'API access',
          'Team collaboration',
          'Custom features'
        ],
        buttonText: 'Contact Sales',
        popular: false
      }
    ].map((plan) => (
      <div
        key={plan.name}
        className={`pricing-card ${plan.popular ? 'popular' : ''}`}
      >
        {plan.popular && (
          <div className="popular-badge">Most Popular</div>
        )}
        <div className="plan-header">
          <h3 className="plan-name">{plan.name}</h3>
          <div className="plan-price">
            <span className="currency">₹</span>
            <span className="amount">{plan.price}</span>
            <span className="period">/month</span>
          </div>
          <p className="plan-description">{plan.description}</p>
        </div>
        
        <ul className="feature-list">
          {plan.features.map((feature, index) => (
            <li key={index} className="feature-item">
              <Check className="feature-icon" size={18} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        <button className={`plan-button ${plan.popular ? 'popular' : ''}`}>
          {plan.buttonText}
        </button>
      </div>
    ))}
  </div>
</section>
      <footer className="footer">
  <div className="footer-content">
    <div className="footer-main">
      <div className="footer-section">
        <h3>Gifmeister</h3>
        <p className="footer-description">Creating and sharing amazing GIFs made simple.</p>
      </div>
      <div className="footer-section">
        <h4>Quick Links</h4>
        <ul>
          <li><a href="/create">Create GIF</a></li>
          <li><a href="/gallery">Gallery</a></li>
          <li><a href="/about">About Us</a></li>
        </ul>
      </div>
      <div className="footer-section">
        <h4>Support</h4>
        <ul>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div className="footer-bottom">
      <p className="copyright">
        &copy; {new Date().getFullYear()} Gifmeister
        <span className="separator">|</span>
        <span className="rights">All rights reserved</span>
      </p>
    </div>
  </div>
</footer>
    </div>
  );
}

export default App;
