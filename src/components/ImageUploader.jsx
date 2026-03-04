import { useDropzone } from 'react-dropzone';

export default function ImageUploader({ onImagesAdded }) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        onDrop: (accepted) => {
            if (accepted.length > 0) onImagesAdded(accepted);
        },
    });

    return (
        <div
            {...getRootProps()}
            className={`drop-zone ${isDragActive ? 'active' : ''}`}
        >
            <input {...getInputProps()} />
            <span className="drop-icon">🖼️</span>
            <h3>{isDragActive ? 'Rilascia qui le immagini…' : 'Trascina le immagini qui'}</h3>
            <p>
                oppure <span className="browse-link">sfoglia i file</span>
                <br />
                PNG, JPG, WebP — nessun limite
            </p>
        </div>
    );
}
